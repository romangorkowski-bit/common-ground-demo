import { canonical, sameEntity } from "@/lib/affinity/normalize";
import { deriveSeniority, prepareStudent } from "@/lib/affinity/predicates";
import { rankPeople } from "@/lib/affinity/score";
import { SENIORITY_LADDER, type Person, type ScorableStudent } from "@/lib/affinity/types";
import { studentGradYear } from "@/lib/positions/score";
import { ARCHETYPE_LABEL, ARCHETYPE_LEVEL, detectArchetype, type Archetype } from "./archetype";

/**
 * Referral likelihood, 1 to 5: how likely this person is to refer the student
 * into a company they want, after the report's two tests. Will they act on the
 * student's behalf (the archetype), and will their referral land where the
 * student is applying (the target check, closure)?
 *
 * It sits beside the connection ladder, not in place of it. The ladder picks
 * the opening line; this picks who to ask. Within a level, people keep the
 * ladder's order.
 */
export type Level = 1 | 2 | 3 | 4 | 5;

export const LEVEL_LABEL: Record<Level, string> = {
  5: "Very likely",
  4: "Likely",
  3: "Possible",
  2: "Unlikely",
  1: "Long shot",
};

export interface ReferralResult {
  personId: string;
  level: Level;
  label: string;
  archetype: Archetype;
  archetypeLabel: string;
  atTarget: boolean;
  /** Why this level, strongest reason first; adjustments are listed with their sign. */
  reasons: string[];
  adjustments: { reason: string; delta: 1 | -1 }[];
  /** Set when the hook is a recent event or post: say when to write. */
  contactSoon: string | null;
  /** The ladder score, the tie-break inside a level. */
  ladderScore: number;
}

const rung = (s: string | null | undefined) => (s ? SENIORITY_LADDER.indexOf(s as never) : -1);
const SENIOR = rung("director");
const NEAR_PEER_MAX = rung("senior_associate");
const NEAR_PEER_MIN = rung("analyst");

/**
 * Everyone, rated and ordered. Closure needs the whole pool (it counts warm
 * contacts at each company), so a single person is rated through this too.
 */
export function rankByReferral(
  student: ScorableStudent,
  people: readonly Person[],
  opts?: { now?: number },
): ReferralResult[] {
  const now = opts?.now ?? Date.now();
  const idx = prepareStudent(student);
  const gradYear = studentGradYear(student);
  const ladder = new Map(rankPeople(student, people, { now }).results.map((r) => [r.personId, r]));
  const noTargets = idx.targetCompanies.length === 0;

  // Pass 1: archetype, then the target check.
  const first = people.map((person) => {
    const l = ladder.get(person.id)!;
    const hit = detectArchetype(student, idx, person, l, gradYear, now);
    const company = canonical("company", person.currentCompany);
    const atTarget = noTargets || idx.targetCompanies.some((t) => sameEntity("company", t, company));
    let base = ARCHETYPE_LEVEL[hit.archetype];
    const reasons = [...hit.reasons];
    if (!atTarget) {
      if (base >= 3) {
        base = 2;
        reasons.push(`${person.currentCompany || "Their company"} is not on your target list. Ask for advice and names, not a referral.`);
      } else {
        base = 1;
      }
    } else if (!noTargets) {
      reasons.push(`At ${person.currentCompany}, a company you're targeting.`);
    }
    return { person, ladder: l, hit, company, atTarget, base, reasons };
  });

  // Closure: warm contacts (level 3+) per company.
  const warmAt = new Map<string, number>();
  for (const f of first) {
    if (f.base >= 3 && f.company.key) warmAt.set(f.company.key, (warmAt.get(f.company.key) ?? 0) + 1);
  }

  // Pass 2: at most one level of adjustment, in either direction.
  const results = first.map(({ person, ladder: l, hit, company, atTarget, base, reasons }) => {
    const adjustments: ReferralResult["adjustments"] = [];
    // Lifts only move people from 2-3 up to 3-4: a 4 cannot become a 5
    // (only a sponsor is a 5), and a recruiter's submission lands in the
    // recruiter queue, not the employee-referral one, whatever else is true.
    const canRise = atTarget && base <= 3 && hit.archetype !== "recruiter";
    const others = (company.key ? warmAt.get(company.key) ?? 0 : 0) - (base >= 3 ? 1 : 0);
    if (canRise && others >= 2) {
      adjustments.push({ reason: `${others} other warm contacts at ${person.currentCompany}. Several voices inside make a hire there more likely.`, delta: 1 });
    }

    const seniority = rung(person.currentSeniority ?? deriveSeniority(person.currentTitle));
    const lastGrad = Math.max(...person.education.map((e) => e.endYear ?? 0), 0);
    const nearPeer = (gradYear != null && lastGrad > 0 && gradYear - lastGrad >= 1 && gradYear - lastGrad <= 5)
      || (seniority >= NEAR_PEER_MIN && seniority <= NEAR_PEER_MAX);
    if (canRise && base >= 2 && nearPeer) {
      adjustments.push({ reason: "A few years ahead of you, so the most likely to remember the search and reply.", delta: 1 });
    }

    if (seniority >= SENIOR && hit.archetype !== "sponsor" && hit.archetype !== "advocate") {
      adjustments.push({ reason: `${person.currentTitle} is too senior for a cold ask. Start with someone nearer your level.`, delta: -1 });
    }

    const net = Math.max(-1, Math.min(1, adjustments.reduce((n, a) => n + a.delta, 0)));
    const level = Math.max(1, Math.min(5, base + net)) as Level;

    return {
      personId: person.id,
      level,
      label: LEVEL_LABEL[level],
      archetype: hit.archetype,
      archetypeLabel: ARCHETYPE_LABEL[hit.archetype],
      atTarget,
      reasons: [...reasons, ...adjustments.map((a) => `${a.delta > 0 ? "+1" : "−1"} · ${a.reason}`)],
      adjustments,
      contactSoon: l.rank === 8 || l.rank === 9 ? l.outreach.timing : null,
      ladderScore: l.score,
    } satisfies ReferralResult;
  });

  return results.sort((a, b) => b.level - a.level || b.ladderScore - a.ladderScore);
}

export function scoreReferral(
  student: ScorableStudent,
  person: Person,
  pool: readonly Person[] = [person],
  opts?: { now?: number },
): ReferralResult {
  const people = pool.some((p) => p.id === person.id) ? pool : [...pool, person];
  return rankByReferral(student, people, opts).find((r) => r.personId === person.id)!;
}

