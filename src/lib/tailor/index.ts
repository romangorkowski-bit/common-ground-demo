import { findFabrications, type Fabrication } from "@/lib/ai/fabrication-check";
import type { AffinityFacts, StudentProfile, TailoredResume } from "@/lib/ai/schemas";
import { tailorResume } from "@/lib/ai/tailor-resume";
import { MODEL } from "@/lib/ai/client";
import { AI_QUERY_MODEL } from "@/lib/databricks/sql";
import { rewriteResume } from "@/lib/plan/rewrite";
import type { Position } from "@/lib/positions";
import { analyzeJob, type JobAnalysis } from "./analysis";
import { formatCheck, type FormatCheck } from "./format";
import { renderResumePdf, type ResumeHeader } from "./pdf";
import { bulletRefs, liveMetrics } from "./refs";
import { rulesTailor } from "./rules";

/**
 * The resume tailor: the four skill guides as one pass.
 *
 *   1. job-description-analyzer  -> analyzeJob (computed, see analysis.ts)
 *   2. resume-tailor              -> a model following the guides, or rulesTailor
 *   3. resume-bullet-writer       -> the same call; numbers only from the student
 *   4. resume-formatter           -> the PDF layout and formatCheck
 *
 * Every result goes through findFabrications, including the rules mode, so a
 * bug in the rules is caught the same way a model's invention is.
 */
export type TailorMode = "anthropic" | "databricks" | "rules";

/** TAILOR_PROVIDER wins; otherwise whichever model the deployment has credentials for, else rules. */
export function tailorMode(): TailorMode {
  const asked = process.env.TAILOR_PROVIDER;
  if (asked === "anthropic" || asked === "databricks" || asked === "rules") return asked;
  if (process.env.DATABRICKS_HOST && process.env.DATABRICKS_TOKEN) return "databricks";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "rules";
}

export interface TailorOutcome {
  analysis: JobAnalysis;
  resume: TailoredResume;
  fabrications: Fabrication[];
  format: FormatCheck[];
  pages: number;
  mode: TailorMode;
  model: string;
  /** Set when a model was asked and failed, and the rules result stands in. */
  note: string | null;
  durationMs: number;
}

export function resumeHeader(profile: StudentProfile, email: string | null): ResumeHeader {
  return { name: profile.full_name ?? "Your Name", contact: [email].filter((c): c is string => Boolean(c)) };
}

export async function tailorForPosting(input: {
  profile: StudentProfile;
  facts: AffinityFacts;
  position: Position;
  email?: string | null;
  mode?: TailorMode;
}): Promise<TailorOutcome> {
  const t0 = Date.now();
  const { profile, facts, position } = input;
  const mode = input.mode ?? tailorMode();
  const analysis = analyzeJob({ profile, facts }, position);
  const metrics = liveMetrics(profile, facts.metrics);
  const rules = () => rulesTailor({ profile, facts, position, analysis, metrics });

  let resume: TailoredResume;
  let model = "none (rules)";
  let note: string | null = null;
  try {
    if (mode === "anthropic") {
      resume = (await tailorResume({ profile, position, analysis, metrics })).resume;
      model = MODEL;
    } else if (mode === "databricks") {
      const r = await rewriteResume(profile, position, { analysis, metrics });
      if (!r.resume) throw new Error(r.error ?? "no resume came back");
      resume = r.resume;
      model = AI_QUERY_MODEL;
    } else {
      resume = rules();
    }
  } catch (err) {
    console.error("[tailor] model path failed; using rules", err);
    note = `The model did not finish (${err instanceof Error ? err.message : String(err)}), so this is the rules-only version.`;
    resume = rules();
  }

  // A model's metric questions must point at a real, unanswered line.
  const refs = new Set(bulletRefs(profile).map((b) => b.ref));
  resume = { ...resume, metricPrompts: resume.metricPrompts.filter((m) => refs.has(m.bulletRef) && !metrics[m.bulletRef]) };

  const header = resumeHeader(profile, input.email ?? null);
  const { pages } = await renderResumePdf(resume, header);
  return {
    analysis,
    resume,
    fabrications: findFabrications(profile, resume, metrics),
    format: formatCheck(resume, { pages, name: profile.full_name, contact: header.contact }),
    pages,
    mode: note ? "rules" : mode,
    model,
    note,
    durationMs: Date.now() - t0,
  };
}

export { analyzeJob, type JobAnalysis } from "./analysis";
export { renderResumePdf, resumeFileName } from "./pdf";
export type { FormatCheck } from "./format";
