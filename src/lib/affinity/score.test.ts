import assert from "node:assert/strict";
import { test } from "vitest";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
import { NOW, cast, p2, p5, student } from "./__fixtures__/cast";
import { rankPeople, scoreAffinity } from "./score";
import type { Person } from "./types";

test("more shared organisations scores higher, but stays in the same tier", () => {
  const one: Person = { ...p2, education: [{ ...p2.education[0], activities: ["Delta Sigma Pi"] }] };
  const two: Person = {
    ...p2,
    education: [{ ...p2.education[0], activities: ["Delta Sigma Pi", "Investment Club"] }],
  };
  const a = scoreAffinity(student, one, { now: NOW });
  const b = scoreAffinity(student, two, { now: NOW });

  assert.equal(a.rank, 2);
  assert.equal(b.rank, 2);
  assert.ok(b.score > a.score);
});

test("corroboration breaks ties inside a band and never across one", () => {
  const plain = { ...p2, id: "plain" };
  const alsoHometown: Person = { ...p2, id: "also", hometown: "Norfolk, VA" };

  const a = scoreAffinity(student, plain, { now: NOW });
  const b = scoreAffinity(student, alsoHometown, { now: NOW });

  assert.equal(a.rank, 2);
  assert.equal(b.rank, 2, "a second commonality must not change which hook you open with");
  assert.ok(b.score > a.score);
  assert.ok(b.score - a.score <= 2, `corroboration moved the score by ${b.score - a.score}`);
});

test("evidence names the actual thing in common", () => {
  const r = scoreAffinity(student, p2, { now: NOW });
  assert.equal(r.evidence[0].kind, "org");
  assert.match(r.evidence[0].label, /Delta Sigma Pi/);
  assert.match(r.outreach.opener, /Delta Sigma Pi/);
});

test("a missing fact is reported as the tier it would have unlocked", () => {
  const noHometown = { ...student, facts: { ...student.facts, hometown: null } };
  const r = scoreAffinity(noHometown, p5, { now: NOW });

  assert.notEqual(r.rank, 5);
  const unlock = r.unlockable.find((u) => u.fieldId === "hometown");
  assert.ok(unlock, "should have flagged hometown as unlockable");
  assert.equal(unlock!.rank, 5);
  assert.match(unlock!.because, /Norfolk/);
});

test("demand is aggregated across everyone, for ordering the questions", () => {
  const blank = { ...student, facts: { ...EMPTY_FACTS, school_canonical: "Virginia Tech" } };
  const { demand } = rankPeople(blank, cast, { now: NOW });

  assert.ok(demand.length > 0);
  assert.deepEqual([...demand].sort((a, b) => b.count - a.count || a.rank - b.rank), demand);
  for (const d of demand) assert.ok(d.examples.length > 0 && d.examples.length <= 3);
});

test("scoring does not mutate its inputs", () => {
  const frozenPerson = Object.freeze({ ...p2, education: Object.freeze([...p2.education]) }) as Person;
  const frozenStudent = Object.freeze({ ...student, facts: Object.freeze({ ...student.facts }) });
  assert.doesNotThrow(() => scoreAffinity(frozenStudent, frozenPerson, { now: NOW }));
});

test("ranking is a total order, so the demo is stable across runs", () => {
  const a = rankPeople(student, cast, { now: NOW }).results.map((r) => r.personId);
  const b = rankPeople(student, [...cast].reverse(), { now: NOW }).results.map((r) => r.personId);
  assert.deepEqual(a, b);
});
