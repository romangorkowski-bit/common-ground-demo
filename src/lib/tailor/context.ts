import type { MetricAnswer, StudentProfile } from "@/lib/ai/schemas";
import type { Position } from "@/lib/positions";
import type { JobAnalysis } from "./analysis";
import { bulletRefs } from "./refs";

/**
 * The user turn every model path sends: the posting, the analysis already
 * computed for it, the confirmed profile, the bullet refs to hang metric
 * questions on, and the numbers the student has given. Shared by the
 * Anthropic and Databricks paths so they tailor from identical input.
 */
export function tailorContext(input: {
  profile: StudentProfile;
  position: Pick<Position, "title" | "company" | "description" | "requirements">;
  analysis?: JobAnalysis | null;
  metrics?: Record<string, MetricAnswer>;
}): string {
  const { profile, position, analysis, metrics = {} } = input;
  const posting = {
    title: position.title,
    company: position.company,
    description: (position.description ?? "").slice(0, 8000) || null,
    requirements: position.requirements.map((r) => `${r.requirement} (${r.required ? "required" : "preferred"})`),
  };
  const refs = bulletRefs(profile).map((b) => `${b.ref}  [${b.owner}]  ${b.text}`);
  const answers = Object.entries(metrics).map(([ref, m]) => `${ref}: ${m.value} ${m.unit}`.trim());
  return [
    `POSTING:\n${JSON.stringify(posting)}`,
    analysis
      ? `ANALYSIS (job-description-analyzer, already computed; do not recompute):\n${JSON.stringify({
        matchScore: analysis.matchScore, keywords: analysis.keywords, gaps: analysis.gaps,
      })}`
      : "",
    `CONFIRMED PROFILE:\n${JSON.stringify(profile)}`,
    `BULLET REFS:\n${refs.join("\n") || "(none)"}`,
    `METRIC ANSWERS:\n${answers.join("\n") || "(none yet)"}`,
  ].filter(Boolean).join("\n\n");
}
