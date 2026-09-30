import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, student } from "@/lib/affinity/__fixtures__/cast";
import { mockPositions } from "@/lib/positions/mock";
import { rankPositions } from "@/lib/positions/score";
import { runPlanAgent, timelineFor } from "./agent";
import { learningOptionsLocal } from "./catalog";

const positions = mockPositions(NOW);
const ranked = rankPositions(student, positions, { now: NOW });
const cyberRisk = positions.find((p) => p.id === "m02")!; // Deloitte Cyber Risk Intern: Security+ required

test("the bundled catalog answers by requirement, cheapest first", () => {
  const opts = learningOptionsLocal("security+");
  assert.equal(opts.length, 1);
  assert.equal(opts[0].provider, "CompTIA");
  assert.deepEqual(learningOptionsLocal("Underwater basket weaving"), []);
  const excel = learningOptionsLocal("Excel modeling");
  assert.ok(excel.length >= 1 && excel[0].cost_usd === 0);
});

test("mock mode runs the tools in a fixed order and says so, without a model", async () => {
  const r = await runPlanAgent({ student, position: cyberRisk, ranked, mode: "mock" });
  assert.equal(r.mode, "fallback");
  assert.match(r.model, /mock/);
  assert.equal(r.trace[0].tool, "skill_gaps");
  assert.ok(r.trace.slice(1).every((t) => t.tool === "learning_options"));
  assert.equal(r.resume, null);
  assert.match(r.note ?? "", /fixed order/);
});

test("every plan step is grounded in a catalog row or says the catalog has none", async () => {
  const r = await runPlanAgent({ student, position: cyberRisk, ranked, mode: "mock" });
  for (const s of r.plan.steps) {
    if (s.provider) {
      assert.ok(s.url && s.cost_usd != null && s.weeks != null, s.requirement);
    } else {
      assert.match(s.action, /catalog/);
    }
  }
  assert.equal(r.plan.totalCost, r.plan.steps.reduce((n, s) => n + (s.cost_usd ?? 0), 0));
});

test("a certification the student is already studying for is not a plan step", async () => {
  const studying = {
    ...student,
    profile: { ...student.profile, affinity: { ...student.profile.affinity, certifications_in_progress: ["Security+"] } },
    facts: { ...student.facts, certifications_in_progress: ["Security+"] },
  };
  const r = await runPlanAgent({ student: studying, position: cyberRisk, ranked, mode: "mock" });
  // Security+ in certifications_in_progress -> status in_progress -> not "missing" -> not planned.
  assert.ok(!r.plan.steps.some((s) => s.requirement === "Security+"));
});

test("a posting with nothing missing yields an empty, honest plan", async () => {
  const easy = { ...cyberRisk, id: "easy", requirements: [{ requirement: "Python", kind: "skill" as const, required: true }] };
  const r = await runPlanAgent({ student, position: easy, ranked, mode: "mock" });
  assert.deepEqual(r.plan.steps, []);
  assert.match(r.plan.timeline, /Nothing is missing/);
});

test("the timeline says when the plan does not fit before the window opens", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  assert.match(timelineFor(4, "2026-12-30", now), /About 4 weeks of effort, and 12 weeks before/);
  assert.match(timelineFor(19, "2026-10-12", now), /but only 11 days before the window opens 2026-10-12/);
  assert.match(timelineFor(3, "2026-09-01", now), /already open/);
});
