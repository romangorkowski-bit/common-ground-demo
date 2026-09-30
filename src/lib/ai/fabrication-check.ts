import type { MetricAnswer, StudentProfile, TailoredResume } from "./schemas";

/**
 * Structural check that a tailored resume invented nothing.
 *
 * A model instructed not to fabricate mostly complies, but "mostly" is not a
 * standard a student can rely on — they sign their name to this document. So
 * every hard fact in the output is checked against the confirmed profile, and
 * anything unsupported is surfaced rather than silently shipped.
 *
 * Scope: verifiable identity facts (employers, titles, dates, school), skills
 * and keywords, and every number. Bullet wording is otherwise not checked —
 * rephrasing is the point of tailoring. Numbers are, because the bullet-writer
 * guide asks for a metric in every bullet and a model will happily supply one.
 */

export interface Fabrication {
  field: string;
  value: string;
  detail: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "1,200", "40%", "3.5" -> "1200", "40", "3.5". Leading zeros go, so "06" and "6" agree. */
const numbersIn = (s: string): string[] =>
  (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, ""))));

export function findFabrications(
  profile: StudentProfile,
  resume: TailoredResume,
  metrics: Record<string, MetricAnswer> = {},
): Fabrication[] {
  const problems: Fabrication[] = [];

  const employers = new Set(profile.experience.map((e) => norm(e.employer)));
  const titlesByEmployer = new Map<string, Set<string>>();
  for (const e of profile.experience) {
    const key = norm(e.employer);
    if (!titlesByEmployer.has(key)) titlesByEmployer.set(key, new Set());
    titlesByEmployer.get(key)!.add(norm(e.title));
  }
  const datesByEmployer = new Map(
    profile.experience.map((e) => [norm(e.employer), { start: e.start, end: e.end }]),
  );

  for (const role of resume.experience) {
    const key = norm(role.employer);

    if (!employers.has(key)) {
      problems.push({
        field: "experience.employer",
        value: role.employer,
        detail: "employer does not appear in the confirmed profile",
      });
      continue;
    }

    if (!titlesByEmployer.get(key)!.has(norm(role.title))) {
      problems.push({
        field: "experience.title",
        value: `${role.title} at ${role.employer}`,
        detail: "job title differs from the confirmed profile",
      });
    }

    const source = datesByEmployer.get(key)!;
    for (const [field, got, want] of [
      ["start", role.start, source.start],
      ["end", role.end, source.end],
    ] as const) {
      if (got && want && norm(got) !== norm(want)) {
        problems.push({
          field: `experience.${field}`,
          value: `${role.employer}: ${got}`,
          detail: `profile says "${want}"`,
        });
      }
    }
  }

  const projects = new Set(profile.projects.map((p) => norm(p.name)));
  for (const project of resume.projects) {
    if (!projects.has(norm(project.name))) {
      problems.push({
        field: "projects.name",
        value: project.name,
        detail: "project does not appear in the confirmed profile",
      });
    }
  }

  if (profile.school && norm(resume.education.school) !== norm(profile.school)) {
    problems.push({
      field: "education.school",
      value: resume.education.school,
      detail: `profile says "${profile.school}"`,
    });
  }

  // Skills are the easiest thing for a model to "helpfully" add because the
  // posting asked for them — which is exactly the dangerous case.
  const known = new Set([
    ...profile.skills.map(norm),
    ...profile.projects.flatMap((p) => p.skills.map(norm)),
    ...profile.coursework.map((c) => norm(c.title)),
  ]);
  for (const skill of resume.skills) {
    if (!known.has(norm(skill))) {
      problems.push({
        field: "skills",
        value: skill,
        detail: "skill is not claimed anywhere in the confirmed profile",
      });
    }
  }
  for (const keyword of resume.keywordsAdded) {
    if (!known.has(norm(keyword))) {
      problems.push({
        field: "keywordsAdded",
        value: keyword,
        detail: "keyword is not supported by a skill, project or course in the profile",
      });
    }
  }

  // A number is allowed only if the profile already has it or the student
  // typed it on the resume page. "~40%" from nowhere is the likeliest slip.
  const allowed = new Set([
    ...numbersIn(JSON.stringify(profile)),
    ...Object.values(metrics).flatMap((m) => numbersIn(m.value)),
  ]);
  const lines = [
    { field: "summary", text: resume.summary },
    ...resume.experience.flatMap((e) => e.bullets.map((b) => ({ field: `experience.bullets (${e.employer})`, text: b }))),
    ...resume.projects.flatMap((p) => p.bullets.map((b) => ({ field: `projects.bullets (${p.name})`, text: b }))),
    ...resume.education.highlights.map((h) => ({ field: "education.highlights", text: h })),
  ];
  for (const { field, text } of lines) {
    const invented = numbersIn(text).filter((n) => !allowed.has(n));
    if (invented.length) {
      problems.push({
        field,
        value: text,
        detail: `${invented.join(", ")} is not in the profile or your answers`,
      });
    }
  }

  return problems;
}
