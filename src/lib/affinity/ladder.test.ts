import assert from "node:assert/strict";
import { test } from "vitest";
import { EXPECTED_ORDER, NOW, cast, p11, p2, p3, p4, p5, p7, student } from "./__fixtures__/cast";
import { BAND, IN_SCOPE_RANKS, SPAN, TIERS, baseFor } from "./tiers";
import { rankPeople, scoreAffinity } from "./score";
import type { Person } from "./types";

test("the ladder ranks in the intended order", () => {
  const { results } = rankPeople(student, cast, { now: NOW });
  assert.deepEqual(results.map((r) => r.rank), [...EXPECTED_ORDER]);

  const scores = results.map((r) => r.score);
  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(scores[i] < scores[i - 1], `score ${scores[i]} at ${i} is not below ${scores[i - 1]}`);
  }
});

test("every in-scope tier is reachable", () => {
  const { results } = rankPeople(student, cast, { now: NOW });
  const reached = new Set(results.map((r) => r.rank));
  for (const rank of IN_SCOPE_RANKS) {
    assert.ok(reached.has(rank), `no fixture reaches tier ${rank} — the predicate may never fire`);
  }
});

test("a lower tier can never outscore a higher one, however much it stacks", () => {
  // Dana matches tier 2 and nothing else: one shared org, derived not aliased.
  const minimalTier2: Person = {
    ...p2,
    education: [{ ...p2.education[0], activities: ["Investment Club"] }],
    currentCompany: "Grant Thornton",
  };
  // A stack of everything below it, all at full strength.
  const maximalStack: Person = {
    ...p4,
    hometown: p5.hometown,
    interests: p7.interests,
    currentCompany: "Deloitte",
    currentFunction: "consulting",
    roles: [...p4.roles, ...p11.roles, ...p3.roles],
  };

  const a = scoreAffinity(student, minimalTier2, { now: NOW });
  const b = scoreAffinity(student, maximalStack, { now: NOW });

  assert.equal(a.rank, 2);
  assert.ok(b.rank > 2, `stacked person landed at tier ${b.rank}`);
  assert.ok(a.score > b.score, `tier ${a.rank} (${a.score}) did not beat tier ${b.rank} (${b.score})`);
});

test("bands never overlap", () => {
  // Computed from the table on purpose. Do not replace with literals: this is
  // the invariant that makes "sort by score" mean "sort by tier".
  assert.ok(SPAN < BAND, "SPAN must stay below BAND or bands bleed into each other");
  for (let i = 1; i < IN_SCOPE_RANKS.length; i += 1) {
    const lower = baseFor(IN_SCOPE_RANKS[i]);
    const higher = baseFor(IN_SCOPE_RANKS[i - 1]);
    assert.ok(lower + SPAN < higher, `tier ${IN_SCOPE_RANKS[i]} can reach into tier ${IN_SCOPE_RANKS[i - 1]}`);
  }
});

test("tiers 1 and 6 are never produced", () => {
  const { results } = rankPeople(student, cast, { now: NOW });
  for (const r of results) assert.ok(r.rank !== 1 && r.rank !== 6);

  const outOfScope = TIERS.filter((t) => !t.inScope).map((t) => t.rank);
  assert.deepEqual(outOfScope, [1, 6]);
  for (const t of TIERS) {
    if (!t.inScope) assert.equal(baseFor(t.rank), 0, "an out-of-scope tier must have no band");
  }
});

test("someone with nothing in common still lands at tier 13 with honest guidance", () => {
  const { results } = rankPeople(student, cast, { now: NOW });
  const last = results[results.length - 1];
  assert.equal(last.rank, 13);
  assert.ok(last.score >= 12 && last.score <= 19);
  assert.equal(last.outreach.guidance, TIERS[12].guidance);
  assert.match(last.outreach.guidance, /earn the right to ask later/);
});
