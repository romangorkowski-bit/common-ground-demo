import type { ScorableStudent } from "@/lib/affinity/types";
import type { TailoredResume } from "@/lib/ai/schemas";
import { AI_QUERY_MODEL, query } from "@/lib/databricks/sql";
import { chat, parseArguments, type ChatMessage, type ToolSpec } from "@/lib/databricks/chat";
import type { Fabrication } from "@/lib/ai/fabrication-check";
import { positionGaps, rankPositions, type Gap, type Position, type RankedPosition } from "@/lib/positions";
import { learningOptionsLocal, learningOptionsWarehouse, type LearningOption } from "./catalog";
import { analyzeJob } from "@/lib/tailor/analysis";
import { liveMetrics } from "@/lib/tailor/refs";
import { rewriteResume } from "./rewrite";

/**
 * The plan agent: given a student and one opening, a Databricks-hosted model
 * decides which tools to call — the gap check, the learning catalog (a Unity
 * Catalog function), the resume rewrite — and returns a plan with its trace.
 *
 * The model reasons and writes; the facts come from tables. Gaps are computed,
 * not guessed; every recommendation is a catalog row with a real cost and
 * time; the rewrite goes through the fabrication check. If the model is
 * unavailable, the same tools run in a fixed order and the trace says so —
 * the page never breaks, and it never pretends.
 */

export interface TraceStep {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ms: number;
}

export interface PlanStep {
  order: number;
  requirement: string;
  kind: string;
  required: boolean;
  action: string;
  provider: string | null;
  cost_usd: number | null;
  weeks: number | null;
  url: string | null;
  why: string;
  inProgress: boolean;
}

export interface Plan {
  positionId: string;
  title: string;
  company: string;
  opensOn: string;
  whyThisRole: string;
  steps: PlanStep[];
  timeline: string;
  totalCost: number;
  totalWeeks: number;
}

export interface AgentResult {
  runId: string;
  mode: "agent" | "fallback";
  model: string;
  plan: Plan;
  resume: TailoredResume | null;
  fabrications: Fabrication[];
  trace: TraceStep[];
  durationMs: number;
  note: string | null;
}

const TOOLS: ToolSpec[] = [
  { type: "function", function: { name: "skill_gaps", description: "The posting's listed skills and certifications the student does not have. required=true rows are hard blockers; status=in_progress means they are already studying for it.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "learning_options", description: "Certifications and courses that close ONE requirement, with cost in USD and weeks. Call once per requirement you want to recommend.", parameters: { type: "object", properties: { requirement: { type: "string", description: "The requirement text exactly as skill_gaps returned it" } }, required: ["requirement"] } } },
  { type: "function", function: { name: "rewrite_resume", description: "Rewrite the student's resume for this posting from the confirmed profile only, then run the fabrication check. Call exactly once, after you have looked at the gaps.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "finish", description: "Return the final plan. Call this last.", parameters: { type: "object", properties: {
    why_this_role: { type: "string", description: "One or two sentences: why this opening fits the student, from the facts you saw" },
    steps: { type: "array", items: { type: "object", properties: {
      requirement: { type: "string" }, action: { type: "string", description: "Which catalog option to take and why, in one sentence" },
      option_id: { type: "string", description: "The catalog id of the option you recommend, from learning_options" },
      order: { type: "integer", description: "1 = do first" } }, required: ["requirement", "action", "order"] } },
    timeline: { type: "string", description: "How to sequence the steps before the window opens, in plain words" },
  }, required: ["why_this_role", "steps", "timeline"] } } },
];

const MAX_TURNS = 8;

export async function runPlanAgent(input: {
  student: ScorableStudent;
  position: Position;
  ranked?: RankedPosition[];
  mode: "databricks" | "mock";
  studentEmail?: string | null;
}): Promise<AgentResult> {
  const t0 = Date.now();
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { student, position } = input;
  const trace: TraceStep[] = [];
  const timed = async <T>(tool: string, args: Record<string, unknown>, fn: () => Promise<T>, summarize: (v: T) => string): Promise<T> => {
    const t = Date.now();
    const v = await fn();
    trace.push({ step: trace.length + 1, tool, args, summary: summarize(v), ms: Date.now() - t });
    return v;
  };

  // Tool implementations. Shared by the agent loop and the fallback.
  const gaps = () => positionGaps(student, position);
  const options = (req: string) => (input.mode === "mock" ? Promise.resolve(learningOptionsLocal(req)) : learningOptionsWarehouse(req));
  const seen = new Map<string, LearningOption[]>();

  let resume: TailoredResume | null = null;
  let fabrications: Fabrication[] = [];
  let rewriteError: string | null = null;

  const fit = (input.ranked ?? rankPositions(student, [position])).find((r) => r.position.id === position.id)?.fit;
  const header = (p: Plan | null, whyDefault: string) => ({
    positionId: position.id, title: position.title, company: position.company, opensOn: position.opensOn,
    whyThisRole: p?.whyThisRole ?? whyDefault, timeline: p?.timeline ?? "", steps: p?.steps ?? [], totalCost: 0, totalWeeks: 0,
  });

  // ------------------------------------------------------------- fallback
  const fallback = async (note: string): Promise<AgentResult> => {
    const g = await timed("skill_gaps", {}, async () => gaps(), (v) => `${v.length} gaps, ${v.filter((x) => x.required && x.status === "missing").length} hard`);
    const steps: PlanStep[] = [];
    const todo = g.filter((x) => x.status === "missing").slice(0, 4);
    for (const gap of todo) {
      const opts = await timed("learning_options", { requirement: gap.requirement }, () => options(gap.requirement), (v) => v.length ? `${v.length} option(s), from $${v[0].cost_usd}` : "no catalog entry");
      seen.set(gap.requirement, opts);
      steps.push(stepFor(gap, opts[0] ?? null, steps.length + 1, opts[0] ? `${opts[0].title} — ${opts[0].note}` : "Not in the catalog yet; ask the club or a person on your list what they did."));
    }
    const plan = finalize(header(null, fit ? fit.reasons.join(". ") : `${position.title} at ${position.company}.`), steps,
      steps.length ? timelineFor(sumWeeks(steps), position.opensOn) : "Nothing is missing; spend the time on the people who can get you in the room.");
    return { runId, mode: "fallback", model: input.mode === "mock" ? "none (mock)" : AI_QUERY_MODEL, plan, resume: null, fabrications: [], trace, durationMs: Date.now() - t0, note };
  };

  if (input.mode === "mock") return fallback("Mock mode: the tools ran in a fixed order; no model was called.");

  // ------------------------------------------------------------- agent loop
  const messages: ChatMessage[] = [
    { role: "system", content:
      "You are a career-planning agent for a university student. You have tools; use them, do not guess. " +
      "Procedure: call skill_gaps; for each hard-required missing item (and up to two preferred ones) call learning_options; " +
      "call rewrite_resume once; then call finish with an ordered plan, cheapest-and-fastest first among hard requirements. " +
      "Never recommend applying anyway or any automated outreach. Keep every string short and plain." },
    { role: "user", content:
      `Student: ${JSON.stringify({ school: student.facts.school_canonical ?? student.profile.school, grad: student.profile.grad_date,
        skills: student.profile.skills, certs_in_progress: [...student.facts.certifications_in_progress, ...student.profile.affinity.certifications_in_progress],
        targets: student.facts.target_companies })}\n` +
      `Opening: ${JSON.stringify({ id: position.id, title: position.title, company: position.company, opens_on: position.opensOn, closes_on: position.closesOn,
        requirements: position.requirements })}\n` +
      (fit ? `Fit score ${fit.score}: ${fit.reasons.join("; ")}\n` : "") + "Build the plan." },
  ];

  let finished: Record<string, unknown> | null = null;
  try {
    for (let turn = 0; turn < MAX_TURNS && !finished; turn += 1) {
      const reply = await chat(messages, { tools: TOOLS, toolChoice: "auto", maxTokens: 900, timeoutMs: 45_000 });
      messages.push({ role: "assistant", content: reply.content ?? null, tool_calls: reply.tool_calls });
      if (!reply.tool_calls?.length) {
        // Prose instead of a call: nudge once, then stop.
        if (turn >= MAX_TURNS - 1) break;
        messages.push({ role: "user", content: "Use the tools. If you are done, call finish." });
        continue;
      }
      for (const call of reply.tool_calls) {
        const name = call.function.name;
        const args = parseArguments(call);
        let result: unknown;
        if (name === "skill_gaps") {
          result = await timed(name, {}, async () => gaps(), (v) => `${v.length} gaps, ${v.filter((x) => x.required && x.status === "missing").length} hard`);
        } else if (name === "learning_options") {
          const req = String(args.requirement ?? "");
          const opts = await timed(name, { requirement: req }, () => options(req), (v) => v.length ? `${v.length} option(s), from $${v[0].cost_usd}` : "no catalog entry");
          seen.set(req, opts);
          result = opts.map(({ id, title, provider, kind, cost_usd, weeks, note }) => ({ id, title, provider, kind, cost_usd, weeks, note }));
        } else if (name === "rewrite_resume") {
          const r = await timed(name, {}, () => rewriteResume(student.profile, position, { analysis: analyzeJob(student, position), metrics: liveMetrics(student.profile, student.facts.metrics) }),
            (v) => v.resume ? `${v.resume.changes.length} edits, ${v.fabrications.length} fabrication(s) caught, ${v.attempts} attempt(s)` : `failed: ${v.error}`);
          resume = r.resume; fabrications = r.fabrications; rewriteError = r.error;
          result = { ok: Boolean(r.resume), changes: r.resume?.changes.length ?? 0, fabrications_caught: r.fabrications.length };
        } else if (name === "finish") {
          finished = args;
          trace.push({ step: trace.length + 1, tool: "finish", args: { steps: Array.isArray(args.steps) ? args.steps.length : 0 }, summary: "plan returned", ms: 0 });
          result = { ok: true };
        } else {
          result = { error: `unknown tool ${name}` };
        }
        messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(result) });
      }
    }
  } catch (err) {
    const note = `The model stopped mid-run (${err instanceof Error ? err.message : String(err)}); the tools finished in a fixed order.`;
    const fb = await fallback(note);
    return { ...fb, resume, fabrications, trace };
  }

  if (!finished) return { ...(await fallback("The model never called finish; the tools finished in a fixed order.")), resume, fabrications };

  // Assemble the plan from what the model chose, but with facts from the tools.
  const gapsNow = gaps();
  const rawSteps = Array.isArray(finished.steps) ? (finished.steps as Record<string, unknown>[]) : [];
  const steps: PlanStep[] = rawSteps
    .map((s, i) => {
      const req = String(s.requirement ?? "");
      const gap = gapsNow.find((g) => g.requirement.toLowerCase() === req.toLowerCase()) ?? { requirement: req, kind: "skill", required: false, status: "missing" } as Gap;
      const opts = seen.get(req) ?? [];
      const chosen = opts.find((o) => o.id === String(s.option_id ?? "")) ?? opts[0] ?? null;
      return stepFor(gap, chosen, Number(s.order ?? i + 1), String(s.action ?? chosen?.note ?? ""));
    })
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }));

  const plan = finalize(header(null, String(finished.why_this_role ?? "")), steps, String(finished.timeline ?? ""));
  const result: AgentResult = { runId, mode: "agent", model: AI_QUERY_MODEL, plan, resume, fabrications, trace, durationMs: Date.now() - t0,
    note: rewriteError ? `Resume rewrite: ${rewriteError}` : null };
  void record(result, input.studentEmail ?? null);
  return result;
}

function stepFor(gap: Gap, opt: LearningOption | null, order: number, action: string): PlanStep {
  return {
    order, requirement: gap.requirement, kind: gap.kind, required: gap.required, action,
    provider: opt ? `${opt.title} · ${opt.provider}` : null, cost_usd: opt?.cost_usd ?? null, weeks: opt?.weeks ?? null, url: opt?.url ?? null,
    why: gap.status === "in_progress" ? "Already in progress — finish it" : gap.required ? "Listed as required" : "Listed as preferred",
    inProgress: gap.status === "in_progress",
  };
}

const sumWeeks = (steps: PlanStep[]) => steps.reduce((n, s) => n + (s.weeks ?? 0), 0);

/**
 * The sequencing sentence, measured against the calendar: a plan that needs
 * 19 weeks for a window 11 days out must say so rather than imply it fits.
 */
export function timelineFor(weeks: number, opensOn: string, now = new Date()): string {
  const days = Math.floor((Date.parse(`${opensOn}T00:00:00Z`) - now.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return `Start with the hard requirements. About ${weeks} weeks of effort in all.`;
  if (days <= 0) {
    return `The window is already open. Apply now with what you have, and work on the hard requirements alongside it (about ${weeks} weeks in all).`;
  }
  const left = Math.max(1, Math.floor(days / 7));
  const until = days < 14 ? `${days} days` : `${left} weeks`;
  if (weeks <= left) {
    return `Start with the hard requirements. About ${weeks} weeks of effort, and ${until} before the window opens ${opensOn}.`;
  }
  return `About ${weeks} weeks of effort but only ${until} before the window opens ${opensOn}: do the hard requirements first, apply on time, and keep going on the rest.`;
}

function finalize(head: Omit<Plan, "steps" | "totalCost" | "totalWeeks"> & { steps: PlanStep[]; totalCost: number; totalWeeks: number }, steps: PlanStep[], timeline: string): Plan {
  return { ...head, steps, timeline, totalCost: steps.reduce((n, s) => n + (s.cost_usd ?? 0), 0), totalWeeks: sumWeeks(steps) };
}

/** Best-effort: every run lands in workspace.jobsearch.agent_runs so Genie can answer "what did the agent do". */
async function record(r: AgentResult, email: string | null): Promise<void> {
  try {
    await query(
      `INSERT INTO workspace.jobsearch.agent_runs (run_id, started_at, student_email, position_id, model, steps, duration_ms, trace, plan, fabrications)
       VALUES (:run_id, current_timestamp(), :email, :position_id, :model, :steps, :duration_ms, :trace, :plan, :fabrications)`,
      [
        { name: "run_id", value: r.runId }, { name: "email", value: email ?? "" }, { name: "position_id", value: r.plan.positionId },
        { name: "model", value: r.model }, { name: "steps", value: String(r.trace.length) }, { name: "duration_ms", value: String(r.durationMs) },
        { name: "trace", value: JSON.stringify(r.trace) }, { name: "plan", value: JSON.stringify(r.plan) }, { name: "fabrications", value: String(r.fabrications.length) },
      ],
      { waitTimeout: "15s", pollForMs: 5_000 },
    );
  } catch (err) {
    console.warn("[plan] could not record the run", err instanceof Error ? err.message : err);
  }
}
