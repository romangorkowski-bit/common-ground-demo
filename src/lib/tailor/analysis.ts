import type { ScorableStudent } from "@/lib/affinity/types";
import { positionGaps, type Position, type RequirementKind } from "@/lib/positions";

/**
 * The job-description-analyzer guide, computed. Required vs preferred comes
 * from the posting's own requirement list; the match score is the guide's
 * 70/30 weighting of required and preferred; gaps get the guide's three
 * severities. Computed rather than asked of a model so the score on this page
 * always agrees with the have / missing marks on the opening page.
 */
export type RequirementStatus = "have" | "in_progress" | "missing" | "unchecked";
export type GapSeverity = "critical" | "major" | "minor";

export interface JobAnalysis {
  requirements: { requirement: string; kind: RequirementKind; required: boolean; status: RequirementStatus }[];
  keywords: { hard: string[]; soft: string[]; domain: string[] };
  /** Null when the posting lists nothing we can check against a profile. */
  matchScore: number | null;
  verdict: string;
  gaps: { requirement: string; severity: GapSeverity; note: string }[];
}

/** Tools and methods worth spotting in posting text even when not listed as a requirement. */
const HARD_TERMS = [
  "Python", "SQL", "R", "Excel", "Tableau", "Power BI", "Java", "JavaScript", "TypeScript", "C++", "AWS",
  "Azure", "GCP", "Salesforce", "SAP", "Alteryx", "Spark", "Databricks", "Snowflake", "Linux", "Git",
  "Financial modeling", "Data analysis", "Data visualization", "Machine learning", "Statistics", "Agile",
];
const SOFT_TERMS = [
  "communication", "leadership", "collaboration", "teamwork", "stakeholder", "problem-solving",
  "problem solving", "presentation", "client-facing", "critical thinking", "initiative", "adaptability",
];
const DOMAIN_TERMS = [
  "consulting", "audit", "tax", "risk", "cyber", "public sector", "government", "healthcare", "financial services",
  "banking", "insurance", "technology", "analytics", "supply chain", "energy", "retail", "private equity",
];

const norm = (s: string) => s.trim().toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, so "R" does not match every word with an r in it. */
export const mentions = (text: string, term: string) =>
  new RegExp(`(^|[^a-z0-9+])${escape(norm(term))}($|[^a-z0-9+])`, "i").test(text);

const VERDICTS: [number, string][] = [
  [90, "Meets nearly everything listed. Apply, and lead with the strongest match."],
  [75, "Excellent fit. Worth tailoring for now."],
  [60, "Good fit. Tailor it and say plainly what you are still building."],
  [50, "Stretch role. Apply if you want it; close a gap first if you can."],
  [0, "Under-qualified on paper for now. Close the required gaps before this window opens."],
];

export function analyzeJob(student: ScorableStudent, position: Position): JobAnalysis {
  const gaps = positionGaps(student, position);
  const gapBy = new Map(gaps.map((g) => [norm(g.requirement), g]));
  const requirements = position.requirements.map((r) => ({
    requirement: r.requirement,
    kind: r.kind,
    required: r.required,
    status: (r.kind === "skill" || r.kind === "certification"
      ? gapBy.get(norm(r.requirement))?.status ?? "have"
      : "unchecked") as RequirementStatus,
  }));

  const credit = (rs: typeof requirements) => {
    const checkable = rs.filter((r) => r.status !== "unchecked");
    if (!checkable.length) return null;
    const got = checkable.reduce((n, r) => n + (r.status === "have" ? 1 : r.status === "in_progress" ? 0.5 : 0), 0);
    return got / checkable.length;
  };
  const req = credit(requirements.filter((r) => r.required));
  const pref = credit(requirements.filter((r) => !r.required));
  const matchScore = req == null && pref == null ? null
    : Math.round(100 * (req != null && pref != null ? req * 0.7 + pref * 0.3 : (req ?? pref)!));
  const verdict = matchScore == null
    ? "Nothing on this posting can be checked against a profile. Read the posting itself."
    : VERDICTS.find(([floor]) => matchScore >= floor)![1];

  const text = [position.title, position.description ?? "", ...position.requirements.map((r) => r.requirement)].join(" \n ");
  const listed = position.requirements.filter((r) => r.kind === "skill" || r.kind === "certification").map((r) => r.requirement);
  const hard = [...new Set([
    ...listed,
    ...[...HARD_TERMS, ...student.profile.skills].filter((t) => mentions(text, t)),
  ].map((t) => t.trim()))].filter((t, i, all) => all.findIndex((u) => norm(u) === norm(t)) === i);
  const soft = SOFT_TERMS.filter((t) => mentions(text, t));
  const domain = [...new Set([position.vertical, ...DOMAIN_TERMS.filter((t) => mentions(text, t))].filter((d) => d && d !== "other"))];

  return {
    requirements,
    keywords: { hard, soft, domain },
    matchScore,
    verdict,
    gaps: gaps.map((g) => ({
      requirement: g.requirement,
      severity: g.status === "in_progress" || !g.required ? "minor" : g.kind === "certification" ? "critical" : "major",
      note: g.status === "in_progress"
        ? "Underway. List it as in progress; never as held."
        : !g.required
          ? "Preferred, not required. Leave it off rather than hint at it."
          : g.kind === "certification"
            ? "A required credential you do not hold yet. Check whether they accept one in progress before applying."
            : "Required and not on your profile. Close it, or say honestly in a cover note that you are learning it.",
    })),
  };
}
