import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Position } from "@/lib/positions";
import type { JobAnalysis } from "@/lib/tailor/analysis";
import { tailorContext } from "@/lib/tailor/context";
import { tailorSystemPrompt } from "@/lib/tailor/skills";
import { anthropic, MODEL } from "./client";
import { findFabrications, type Fabrication } from "./fabrication-check";
import { TailoredResumeSchema, type MetricAnswer, type StudentProfile, type TailoredResume } from "./schemas";

/**
 * The resume rewrite on Anthropic. The system prompt is the four skill guides
 * plus the truth rules (src/lib/tailor/skills.ts): the same prompt the
 * Databricks path sends, cached here because it is identical on every call.
 */
export interface TailorResult {
  resume: TailoredResume;
  /** Empty on success. Non-empty means the structural check still caught something. */
  fabrications: Fabrication[];
  attempts: number;
}

export async function tailorResume(input: {
  profile: StudentProfile;
  position: Pick<Position, "title" | "company" | "description" | "requirements">;
  analysis?: JobAnalysis | null;
  metrics?: Record<string, MetricAnswer>;
}): Promise<TailorResult> {
  const { profile, metrics = {} } = input;
  const context = tailorContext(input);

  const request = (correction?: Fabrication[]) =>
    anthropic().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: tailorSystemPrompt(), cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(TailoredResumeSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: context },
            ...(correction
              ? [{
                type: "text" as const,
                text: `Your previous attempt introduced facts absent from the profile:\n` +
                  correction.map((f) => `  - ${f.field}: "${f.value}" — ${f.detail}`).join("\n") +
                  `\nRewrite using only what the profile and METRIC ANSWERS state.`,
              }]
              : []),
          ],
        },
      ],
    });

  let attempts = 0;
  let last: { resume: TailoredResume; fabrications: Fabrication[] } | null = null;

  // One retry: the structural check is cheap and a second pass fixes most
  // slips. Beyond that, hand the problems to the UI rather than loop on cost.
  for (const correction of [undefined, "retry"] as const) {
    attempts++;
    const response = await request(
      correction && last ? last.fabrications : undefined,
    );
    if (!response.parsed_output) {
      throw new Error(`Resume tailoring returned no parsed output (${response.stop_reason})`);
    }

    const resume = response.parsed_output;
    const fabrications = findFabrications(profile, resume, metrics);
    last = { resume, fabrications };
    if (fabrications.length === 0) break;
  }

  return { ...last!, attempts };
}
