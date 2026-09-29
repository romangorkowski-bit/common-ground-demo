import type { ScorableStudent } from "@/lib/affinity/types";
import type { Position } from "./types";

/**
 * Student -> position fit. The same weights as `v_student_position_matches`
 * in databricks/sql/02_views.sql, so a score shown in the app and a score
 * queried in the warehouse agree:
 *
 *   vertical fit        40 primary / 25 secondary   (0 = not a fit, filtered out)
 *   grad-year window    20
 *   skill overlap       up to 25 (15 when the posting lists no skills)
 *   cert coverage       up to 10 (5 when the posting lists none)
 *   window timing       +5 open / +5 opens soon / +2 upcoming / -20 closed
 *   missing hard cert   -10
 *
 * One addition the SQL does not have, because the warehouse's students table
 * has no equivalent of the intake answer: +10 when the company is one the
 * student named as a target. It is listed in `reasons` like everything else.
 */

export type WindowStatus = "open" | "opens_soon" | "upcoming" | "closed";

export interface PositionScore {
  positionId: string;
  score: number;
  windowStatus: WindowStatus;
  /** False when the source had no dates; the label should say "posted", not a countdown. */
  datesKnown: boolean;
  justPosted: boolean;
  /** Negative once open. */
  daysUntilOpen: number;
  reasons: string[];
  primaryVertical: boolean;
}

const VERTICAL_WORDS: Record<string, RegExp> = {
  accounting: /\b(account|audit|tax|cpa|assurance|forensic)/i,
  engineering: /\b(mechanical|electrical|civil|chemical|aerospace|industrial eng|hardware|manufacturing)/i,
  operations: /\b(operations|supply chain|logistics|procurement)/i,
  business: /\b(sales|business development|marketing|communications|human resources|\bhr\b|people ops|legal|policy|compliance|nonprofit|public sector)/i,
  design: /\b(design|ux|ui|product design)/i,
  science: /\b(research|scien|healthcare|biolog|chem|lab)/i,
  swe: /\b(software|engineer(ing)?|developer|swe|backend|frontend|full[- ]?stack|ml|machine learning|data eng|sre|devops|security eng|cyber)/i,
  consulting: /\b(consult|advisory|strategy|analyst|business analyst|technology analyst|public sector)/i,
  finance: /\b(financ|banking|investment|trading|trader|quant|equity|asset|wealth|capital)/i,
};

/**
 * The student's verticals, most-wanted first, derived from what intake and the
 * resume already captured. Nothing here is asked twice: target function, target
 * roles and target industries are all existing fields.
 */
export function studentVerticals(student: ScorableStudent): string[] {
  const { facts, profile } = student;
  const texts = [
    facts.target_function ?? "",
    ...facts.target_roles,
    ...profile.targets.industries,
    ...profile.targets.roles,
    facts.desired_transition?.to ?? "",
  ].filter(Boolean);
  const out: string[] = [];
  for (const t of texts) {
    for (const [vertical, re] of Object.entries(VERTICAL_WORDS)) {
      if (re.test(t) && !out.includes(vertical)) out.push(vertical);
    }
  }
  return out;
}

export function studentGradYear(student: ScorableStudent): number | null {
  const s = student.facts.school_grad_year ?? student.profile.grad_date;
  const m = s ? /(\d{4})/.exec(s) : null;
  return m ? Number(m[1]) : null;
}

const norm = (s: string) => s.trim().toLowerCase();

const DAY = 86_400_000;
const dayDiff = (iso: string, now: number) => Math.round((Date.parse(iso + "T00:00:00Z") - now) / DAY);

export function windowStatus(position: Position, now: number): { status: WindowStatus; daysUntilOpen: number } {
  // No dates from the source: it is posted and open, and the UI says "posted".
  if (!position.datesKnown) return { status: "open", daysUntilOpen: 0 };
  const daysUntilOpen = dayDiff(position.opensOn, now);
  const daysUntilClose = dayDiff(position.closesOn, now);
  if (daysUntilOpen <= 0 && daysUntilClose >= 0) return { status: "open", daysUntilOpen };
  if (daysUntilOpen > 0 && daysUntilOpen <= 60) return { status: "opens_soon", daysUntilOpen };
  if (daysUntilOpen > 60) return { status: "upcoming", daysUntilOpen };
  return { status: "closed", daysUntilOpen };
}

const GRADUATE_ROLE = /\b(ph\.?d|mba|master'?s|masters|graduate student|postdoc|doctoral)\b/i;

export function scorePosition(
  student: ScorableStudent,
  position: Position,
  opts?: { now?: number; verticals?: string[]; allVerticals?: boolean },
): PositionScore | null {
  const now = opts?.now ?? Date.now();
  const verticals = opts?.verticals ?? studentVerticals(student);
  const vIndex = verticals.indexOf(position.vertical);
  // No verticals known yet (blank intake) -> everything is a candidate at the
  // secondary weight, so the page is not empty before the questionnaire.
  // `allVerticals` keeps out-of-vertical roles too, at zero vertical points —
  // a company page shows everything the employer posted, ranked honestly.
  const outside = verticals.length > 0 && vIndex < 0;
  if (outside && !opts?.allVerticals) return null;
  const primary = vIndex === 0;
  const reasons: string[] = [];
  let score = outside ? 0 : verticals.length ? (primary ? 40 : 25) : 25;
  reasons.push(
    outside
      ? `Outside the verticals you told us about (${position.vertical})`
      : verticals.length
      ? `${primary ? "Primary" : "Secondary"} target: ${position.vertical}`
      : `Vertical ${position.vertical} — tell us what you want and this sharpens`,
  );

  const gradYear = studentGradYear(student);
  if (gradYear && position.targetGradYears.includes(gradYear)) {
    score += 20;
    reasons.push(`Targets your class of ${gradYear}`);
  } else if (gradYear && position.targetGradYears.length) {
    reasons.push(`Not aimed at the class of ${gradYear}`);
  }

  const skills = new Set(student.profile.skills.map(norm));
  const reqSkills = position.requirements.filter((r) => r.kind === "skill");
  const matchedSkills = reqSkills.filter((r) => skills.has(norm(r.requirement)));
  if (reqSkills.length === 0) {
    score += 15;
  } else {
    score += (25 * matchedSkills.length) / reqSkills.length;
    reasons.push(
      `${matchedSkills.length}/${reqSkills.length} listed skills` +
        (matchedSkills.length ? `: ${matchedSkills.map((r) => r.requirement).join(", ")}` : ""),
    );
  }

  const certs = new Set([
    ...student.facts.certifications_in_progress,
    ...student.profile.affinity.certifications_in_progress,
  ].map(norm));
  const reqCerts = position.requirements.filter((r) => r.kind === "certification");
  const matchedCerts = reqCerts.filter((r) => certs.has(norm(r.requirement)));
  score += reqCerts.length === 0 ? 5 : (10 * matchedCerts.length) / reqCerts.length;
  const missingHard = reqCerts.filter((r) => r.required && !certs.has(norm(r.requirement)));
  if (missingHard.length) {
    score -= 10;
    reasons.push(`Missing required certification: ${missingHard.map((r) => r.requirement).join(", ")}`);
  }

  const { status, daysUntilOpen } = windowStatus(position, now);
  score += status === "open" ? 5 : status === "opens_soon" ? 5 : status === "upcoming" ? 2 : -20;
  reasons.push(
    !position.datesKnown ? (position.justPosted ? "Just posted" : "Posted; no closing date given")
      : status === "open" ? "Applications open now"
      : status === "opens_soon" ? `Opens in ${daysUntilOpen} days`
      : status === "upcoming" ? `Opens ${position.opensOn}`
      : "Application window closed",
  );

  // The directory mixes in postings for PhD, MBA and master's candidates.
  // The app is for undergraduates, so those sink below every bachelor's
  // role rather than topping the list because the company is a target.
  if (GRADUATE_ROLE.test(position.title)) {
    score -= 30;
    reasons.push("Aimed at graduate students (PhD / MBA / master's)");
  }

  const targets = new Set(student.facts.target_companies.map(norm));
  if (targets.has(norm(position.company))) {
    score += 10;
    reasons.push(`${position.company} is on your target list`);
  }

  return {
    positionId: position.id,
    // Bonuses can stack past the top of the scale; 100 means "as good a fit as we can tell".
    score: Math.min(100, Math.round(score * 10) / 10),
    windowStatus: status,
    datesKnown: position.datesKnown,
    justPosted: position.justPosted,
    daysUntilOpen,
    reasons,
    primaryVertical: primary,
  };
}

export interface RankedPosition { position: Position; fit: PositionScore }

/** Every position the student could plausibly want, best first; closed windows last. */
export function rankPositions(
  student: ScorableStudent,
  positions: readonly Position[],
  opts?: { now?: number; allVerticals?: boolean },
): RankedPosition[] {
  const verticals = studentVerticals(student);
  const now = opts?.now ?? Date.now();
  const ranked: RankedPosition[] = [];
  for (const position of positions) {
    const fit = scorePosition(student, position, { now, verticals, allVerticals: opts?.allVerticals });
    if (fit) ranked.push({ position, fit });
  }
  ranked.sort((a, b) =>
    (a.fit.windowStatus === "closed" ? 1 : 0) - (b.fit.windowStatus === "closed" ? 1 : 0)
    || b.fit.score - a.fit.score
    || a.position.opensOn.localeCompare(b.position.opensOn)
    || a.position.id.localeCompare(b.position.id));
  return ranked;
}
