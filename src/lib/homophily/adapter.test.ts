import assert from "node:assert/strict";
import { test } from "vitest";
import { cast, p2, p4, p13, student } from "@/lib/affinity/__fixtures__/cast";
import type { StoredStudent } from "@/lib/session/demo-store";
import { rankPeopleByHomophily, scorePersonByHomophily } from "./adapter";
import { DEFAULT_WEIGHTS } from "./scorer";

const sam: StoredStudent = {
  profile: student.profile, facts: student.facts, meta: {},
  intakeCompletedAt: null, email: null, homophilyWeights: DEFAULT_WEIGHTS,
};

test("spellings of one school and one employer match through the canonicaliser", () => {
  // Sam's school is "Virginia Tech"; Dana's row says "Virginia Polytechnic
  // Institute and State University". Same fraternity, spelled the same.
  const dana = scorePersonByHomophily(sam, p2);
  assert.ok(dana.matchDrivers.some((d) => d.startsWith("Shared University: Virginia Tech (+5)")), dana.matchDrivers.join(" | "));
  assert.ok(dana.matchDrivers.some((d) => d === "Shared Organization: Delta Sigma Pi (+20)"), dana.matchDrivers.join(" | "));
  assert.equal(dana.totalScore, 25);

  // Marcus worked at Blue Ridge Research Group, where Sam interned.
  const marcus = scorePersonByHomophily(sam, p4);
  assert.deepEqual(marcus.matchDrivers, ["Shared Past Employer: Blue Ridge Research (+30)"]);
  assert.equal(marcus.totalScore, 30);
});

test("weights are the student's own, and change the order", () => {
  const byDefault = rankPeopleByHomophily(sam, cast);
  assert.equal(byDefault[0].personId, p4.id, "employer (30) beats school+club (25) by default");

  const clubsFirst = rankPeopleByHomophily(sam, cast, { ...DEFAULT_WEIGHTS, shared_company: 5, shared_club: 40 });
  assert.equal(clubsFirst[0].personId, p2.id);
});

test("nobody in common reads as the reference's line", () => {
  const jo = scorePersonByHomophily(sam, p13);
  assert.equal(jo.totalScore, 0);
  assert.deepEqual(jo.matchDrivers, ["No shared homophily factors found."]);
});
