import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
import { DEFAULT_WEIGHTS } from "@/lib/homophily/scorer";
import { revive } from "./demo-persist";

const full = {
  profile: student.profile, facts: student.facts, meta: { hometown: { source: "answer", confidence: 1, raw: null, updatedAt: "2026-09-19T12:00:00Z" } },
  intakeCompletedAt: "2026-09-19T12:00:00Z", email: "sam.rivera@vt.edu", homophilyWeights: DEFAULT_WEIGHTS,
};

test("a row written by the app comes back whole", () => {
  const r = revive(JSON.stringify(full))!;
  assert.equal(r.profile.full_name, "Sam Rivera");
  assert.equal(r.facts.hometown, "Norfolk, VA");
  assert.equal(r.meta.hometown.source, "answer");
  assert.equal(r.intakeCompletedAt, full.intakeCompletedAt);
  assert.equal(r.email, "sam.rivera@vt.edu");
});

test("an old or partial row degrades to defaults instead of crashing a page", () => {
  const r = revive(JSON.stringify({ profile: student.profile, facts: { hometown: "Roanoke, VA" } }))!;
  assert.equal(r.facts.hometown, "Roanoke, VA");
  assert.deepEqual(r.facts.student_orgs, EMPTY_FACTS.student_orgs);
  assert.deepEqual(r.meta, {});
  assert.equal(r.intakeCompletedAt, null);
  assert.deepEqual(r.homophilyWeights, DEFAULT_WEIGHTS);
});

test("garbage is null, not a throw", () => {
  assert.equal(revive("not json"), null);
  assert.equal(revive("[]"), null);
  assert.equal(revive(JSON.stringify({ profile: { nonsense: true } })), null);
});
