import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { headlineGap, positionGaps } from "./gaps";
import type { Position } from "./types";

const position: Position = {
  id: "t1", title: "Cyber Risk Intern", company: "Deloitte", companyId: null, type: "internship",
  vertical: "consulting", location: null, opensOn: "2026-10-01", closesOn: "2026-11-01",
  targetGradYears: [2027], description: null, url: null, source: "test",
  category: null, datesKnown: true, justPosted: false, requirementsTypical: false,
  requirements: [
    { requirement: "Python", kind: "skill", required: true },          // Sam has it
    { requirement: "Excel modeling", kind: "skill", required: false },  // Sam lacks it
    { requirement: "Google Data Analytics Certificate", kind: "certification", required: true }, // Sam is studying for it
    { requirement: "PMP", kind: "certification", required: true },       // Sam lacks it
    { requirement: "Bachelor's in business", kind: "degree", required: true }, // never reported
  ],
};

test("a skill the student lists is not a gap; a missing one is", () => {
  const gaps = positionGaps(student, position);
  assert.ok(!gaps.some((g) => g.requirement === "Python"));
  assert.ok(gaps.some((g) => g.requirement === "Excel modeling" && g.status === "missing"));
});

test("a certification in progress is reported as in_progress, not missing", () => {
  const gaps = positionGaps(student, position);
  const sec = gaps.find((g) => g.requirement === "Google Data Analytics Certificate");
  assert.equal(sec?.status, "in_progress");
});

test("degree and experience lines are never reported", () => {
  assert.ok(!positionGaps(student, position).some((g) => (g.kind as string) === "degree"));
});

test("hard blockers come first, certifications before skills, then alphabetical", () => {
  const gaps = positionGaps(student, position);
  assert.deepEqual(gaps.map((g) => g.requirement), ["Google Data Analytics Certificate", "PMP", "Excel modeling"]);
});

test("the headline gap is the hard-required certification the student does not have", () => {
  assert.equal(headlineGap(positionGaps(student, position))?.requirement, "PMP");
});

test("comparison is case- and whitespace-insensitive", () => {
  const loose: Position = { ...position, requirements: [{ requirement: "  python ", kind: "skill", required: true }] };
  assert.deepEqual(positionGaps(student, loose), []);
});
