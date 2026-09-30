import type { MetricAnswer, StudentProfile } from "@/lib/ai/schemas";

/**
 * A stable name for every line of the profile a metric can attach to:
 * `exp:<role>:<bullet>` for experience bullets and `proj:<project>` for a
 * project's summary, both in profile order. The model is handed these so its
 * metric questions point at a line the student can recognise.
 */
export interface BulletRef {
  ref: string;
  owner: string;
  text: string;
}

export function bulletRefs(profile: StudentProfile): BulletRef[] {
  return [
    ...profile.experience.flatMap((e, i) =>
      e.bullets.map((text, j) => ({ ref: `exp:${i}:${j}`, owner: `${e.title}, ${e.employer}`, text }))),
    ...profile.projects.map((p, i) => ({ ref: `proj:${i}`, owner: p.name, text: p.summary })),
  ];
}

/**
 * The answers that still apply. An answer is tied to the text it was given
 * for, so after a new resume rewrites a bullet the old number is dropped
 * rather than stapled to a different sentence.
 */
export function liveMetrics(profile: StudentProfile, metrics: Record<string, MetricAnswer> | undefined): Record<string, MetricAnswer> {
  const byRef = new Map(bulletRefs(profile).map((b) => [b.ref, b.text]));
  return Object.fromEntries(
    Object.entries(metrics ?? {}).filter(([ref, m]) => byRef.get(ref) === m.bullet),
  );
}

/** "1,200" + "survey responses" -> "1,200 survey responses". */
export const metricPhrase = (m: Pick<MetricAnswer, "value" | "unit">) =>
  [m.value.trim(), m.unit.trim()].filter(Boolean).join(" ");

/** What the workspace lists under "your numbers". */
export interface Answer { ref: string; bullet: string; value: string; unit: string }

export const answersOf = (metrics: Record<string, MetricAnswer>): Answer[] =>
  Object.entries(metrics).map(([ref, m]) => ({ ref, bullet: m.bullet, value: m.value, unit: m.unit }));
