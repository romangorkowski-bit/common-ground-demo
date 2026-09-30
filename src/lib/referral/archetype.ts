import { canonical, normalizeText, sameEntity } from "@/lib/affinity/normalize";
import { deriveSeniority, type StudentIndex } from "@/lib/affinity/predicates";
import { SENIORITY_LADDER, type AffinityResult, type Person, type ScorableStudent, type Seniority } from "@/lib/affinity/types";
import { affinityGroup } from "./affinity-groups";

/**
 * Which kind of referrer a person is for this student, after the report's
 * taxonomy. Detection only reads what the ladder already reads; the one new
 * input is the named-affinity-group list.
 */
export type Archetype =
  | "sponsor"        // report #1: has seen the student's work
  | "advocate"       // report #2: same named affinity group (ERG pipeline)
  | "peer"           // report #3: close academic peer
  | "warm_tie"       // report #4: a weak tie with a real hook
  | "alumni"         // report #5: same school, nothing more specific
  | "recruiter"      // report #6: campus / talent acquisition
  | "same_field"     // one step ahead, or same function: a cold but relevant ask
  | "none";

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  sponsor: "Has seen your work",
  advocate: "Affinity group advocate",
  peer: "Close academic peer",
  warm_tie: "Warm weak tie",
  alumni: "Fellow alum",
  recruiter: "Recruiter",
  same_field: "Same field",
  none: "No hook yet",
};

/** The level an archetype starts at, before the target-company check and adjustments. */
export const ARCHETYPE_LEVEL: Record<Archetype, number> = {
  sponsor: 5, advocate: 4, peer: 4, warm_tie: 3, alumni: 3, recruiter: 2, same_field: 2, none: 1,
};

export interface ArchetypeHit {
  archetype: Archetype;
  reasons: string[];
}

const rung = (s: Seniority | null | undefined) => (s ? SENIORITY_LADDER.indexOf(s) : -1);
const year = (s: string | null | undefined) => {
  const m = s ? /(\d{4})/.exec(s) : null;
  return m ? Number(m[1]) : null;
};
const RECRUITER = /\b(recruit\w*|talent acquisition|university relations|campus relations|early careers?)\b/i;

/** Ladder rungs that mean a real, personal hook (rungs 8 and 9 only if they survived decay). */
const WARM_RUNGS = new Set([2, 3, 4, 5, 7, 8, 9]);

export function detectArchetype(
  student: ScorableStudent,
  idx: StudentIndex,
  person: Person,
  ladder: AffinityResult,
  gradYear: number | null,
  now: number,
): ArchetypeHit {
  const thisYear = new Date(now).getUTCFullYear();

  // --- #1 sponsor: at the same employer, at the same time, above the student.
  // The dates come from the resume, but the employer must be one the student
  // confirmed in the questionnaire: the ladder trusts nothing else, and a 5
  // next to "no connection" would contradict it on the same page.
  for (const e of student.profile.experience) {
    const employer = canonical("company", e.employer);
    const start = year(e.start);
    if (!employer.key || start == null) continue;
    if (!idx.employers.some((c) => sameEntity("company", c, employer))) continue;
    const end = year(e.end) ?? thisYear;
    const theirs = rung(deriveSeniority(e.title) ?? "intern");
    for (const r of person.roles) {
      if (!sameEntity("company", employer, canonical("company", r.company))) continue;
      const rStart = r.startYear ?? -Infinity;
      const rEnd = r.endYear ?? thisYear;
      const overlap = rStart <= end && rEnd >= start;
      if (overlap && rung(r.seniority ?? deriveSeniority(r.title)) > theirs) {
        return {
          archetype: "sponsor",
          reasons: [`Was ${r.title} at ${e.employer} while you were ${e.title} there, so they can speak to your work.`],
        };
      }
    }
  }

  // --- #2 advocate: both named the same affinity organisation.
  const studentGroups = [...student.facts.communities, ...student.facts.student_orgs, ...student.facts.programs]
    .map(affinityGroup).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const personGroups = [...person.communities, ...person.education.flatMap((ed) => ed.activities)]
    .map(affinityGroup).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const shared = studentGroups.find((g) => personGroups.some((p) => p.key === g.key));
  if (shared) {
    return { archetype: "advocate", reasons: [`Both in ${shared.display}. Affinity groups exist to bring people like you in.`] };
  }

  // --- #3 peer: same school, graduating within two years, same major or same org.
  const atSchool = idx.school.key
    ? person.education.filter((ed) => sameEntity("school", idx.school, canonical("school", ed.school)))
    : [];
  if (gradYear != null) {
    const majors = student.facts.majors.map(normalizeText);
    for (const ed of atSchool) {
      if (ed.endYear == null || Math.abs(ed.endYear - gradYear) > 2) continue;
      const sameMajor = ed.field && majors.includes(normalizeText(ed.field));
      const sameOrg = ladder.rank === 2
        ? ladder.evidence.find((x) => x.kind === "org")?.personValue
        : null;
      if (sameMajor || sameOrg) {
        return {
          archetype: "peer",
          reasons: [`${ed.school}, class of ${ed.endYear}${sameMajor ? `, also ${ed.field}` : ""}${sameOrg ? `, also in ${sameOrg}` : ""}. Close peers pull each other into the same firms.`],
        };
      }
    }
  }

  // --- #4 warm weak tie: the ladder found a personal hook.
  if (WARM_RUNGS.has(ladder.rank)) {
    const why = ladder.evidence[0]?.label ?? ladder.tierLabel;
    return { archetype: "warm_tie", reasons: [`${why.replace(/[.\s]+$/, "")}. A weak tie with a real reason to write.`] };
  }

  // --- #5 alumni: same school, nothing tighter.
  if (atSchool.length) {
    return { archetype: "alumni", reasons: [`Fellow ${atSchool[0].school} alum.`] };
  }

  // --- #6 recruiter.
  if (RECRUITER.test(person.currentTitle)) {
    return { archetype: "recruiter", reasons: ["A campus recruiter puts you in the recruiter queue, not the employee-referral one."] };
  }

  // --- one step ahead / same function.
  if (ladder.rank === 10 || ladder.rank === 11) {
    return { archetype: "same_field", reasons: [`${ladder.tierLabel}.`] };
  }

  return { archetype: "none", reasons: ["Nothing in common yet beyond wanting to work there."] };
}
