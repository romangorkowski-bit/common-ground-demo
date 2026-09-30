import type { AffinityFacts, StudentProfile } from "@/lib/ai/schemas";
import type { Field } from "./types";

/**
 * What the resume already told us, per field. This is the half of
 * "ask only for what's missing" that decides what counts as already answered.
 *
 * Returns `null` when the resume yielded nothing, which is different from
 * returning `[]` — an empty array here would look like an answer.
 */
export function derive(field: Field, profile: StudentProfile): unknown | null {
  const a = profile.affinity;
  const some = <T>(xs: T[] | undefined): T[] | null => (xs && xs.length ? xs : null);

  switch (field.id) {
    case "school_canonical": return a.school_raw ?? profile.school ?? null;
    case "school_grad_year": return profile.grad_date ?? null;
    case "majors": return some([...a.majors, ...a.minors]);
    case "student_orgs": return some(a.student_orgs);
    case "greek": return some(a.greek);
    case "case_competitions": return some(a.case_competitions);
    case "programs": return some(a.programs);
    case "prior_employers":
      return some([...new Set([
        ...a.prior_employers,
        ...profile.experience.map((e) => e.employer).filter(Boolean),
      ])]);
    case "clients_and_programs": return some(a.clients_and_programs);
    case "certifications_in_progress": return some(a.certifications_in_progress);
    case "projects_public": return some(profile.projects.map((p) => p.name));
    case "technical_domains":
      // Project summaries are the closest a resume gets to "what you actually
      // work on". They are prefills to be corrected, not answers.
      return some(profile.projects.map((p) => p.summary).filter(Boolean));
    case "target_roles": return some(profile.targets?.roles);
    case "target_function": return profile.targets?.industries?.[0] ?? null;
    default: return null;
  }
}

/** Everything the resume can offer, as a partial facts object. */
export function deriveAll(
  fields: readonly Field[],
  profile: StudentProfile,
): Partial<AffinityFacts> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = derive(field, profile);
    if (value !== null) out[field.path] = value;
  }
  return out as Partial<AffinityFacts>;
}
