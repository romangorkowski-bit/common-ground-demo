import { findFabrications, type Fabrication } from "@/lib/ai/fabrication-check";
import { TailoredResumeSchema, type MetricAnswer, type StudentProfile, type TailoredResume } from "@/lib/ai/schemas";
import { chat } from "@/lib/databricks/chat";
import { extractJsonObject } from "@/lib/resume/json";
import type { Position } from "@/lib/positions";
import type { JobAnalysis } from "@/lib/tailor/analysis";
import { tailorContext } from "@/lib/tailor/context";
import { tailorSystemPrompt } from "@/lib/tailor/skills";

/**
 * The resume rewrite, on Databricks.
 *
 * Same prompt as src/lib/ai/tailor-resume.ts (which needs an Anthropic key):
 * the four skill guides, then the truth rules that override them, then the
 * shared context. The output goes through the same structural fabrication
 * check. A 70B model through chat returns a string, so the JSON is extracted
 * leniently and validated with the same zod schema; one retry with the
 * check's findings fed back, then the result is returned with whatever the
 * check still caught — shown, not hidden.
 */

const SHAPE = `Reply with ONE JSON object and nothing else — no prose, no code fence — in exactly this shape:
{"summary":string,"skills":string[],
 "experience":[{"employer":string,"title":string,"start":string|null,"end":string|null,"bullets":string[]}],
 "projects":[{"name":string,"bullets":string[]}],
 "education":{"school":string,"credential":string|null,"grad_date":string|null,"highlights":string[]},
 "changes":[{"change":string,"rationale":string,"before":string|null,"after":string|null}],
 "keywordsAdded":string[],
 "metricPrompts":[{"bulletRef":string,"bullet":string,"question":string,"unit":string}]}`;

export interface RewriteResult {
  resume: TailoredResume | null;
  fabrications: Fabrication[];
  attempts: number;
  error: string | null;
}

export async function rewriteResume(
  profile: StudentProfile,
  position: Position,
  extra: { analysis?: JobAnalysis | null; metrics?: Record<string, MetricAnswer> } = {},
): Promise<RewriteResult> {
  const metrics = extra.metrics ?? {};
  const system = `${tailorSystemPrompt()}\n\n${SHAPE}`;
  const base = tailorContext({ profile, position, analysis: extra.analysis, metrics });

  let fabrications: Fabrication[] = [];
  let last: TailoredResume | null = null;
  let error: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const correction = fabrications.length
      ? `\n\nYour previous draft invented facts. Remove or correct every one of these and reply again:\n` +
        fabrications.map((f) => `- ${f.field}: "${f.value}" — ${f.detail}`).join("\n")
      : "";
    try {
      const reply = await chat(
        [{ role: "system", content: system }, { role: "user", content: base + correction }],
        { maxTokens: 2400, temperature: 0.1, timeoutMs: 60_000 },
      );
      const parsed = TailoredResumeSchema.safeParse(extractJsonObject(reply.content ?? ""));
      if (!parsed.success) {
        error = `resume JSON did not match the schema (${parsed.error.issues[0]?.path.join(".") ?? "?"})`;
        continue;
      }
      last = parsed.data;
      fabrications = findFabrications(profile, parsed.data, metrics);
      error = null;
      if (!fabrications.length) return { resume: last, fabrications, attempts: attempt, error: null };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  return { resume: last, fabrications, attempts: 2, error };
}
