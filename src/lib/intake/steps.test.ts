import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { computeGaps } from "./gaps";
import { groupIntoSteps, humanEstimate, peopleRemaining } from "./steps";

const NOW = Date.parse("2026-09-19T12:00:00Z");
const blankProfile = { ...student.profile, uncertainties: [] };

const allGaps = () => computeGaps({
  profile: {
    ...blankProfile,
    affinity: {
      school_raw: null, majors: [], minors: [], student_orgs: [], greek: [],
      case_competitions: [], programs: [], prior_employers: [],
      clients_and_programs: [], certifications_in_progress: [],
    },
    experience: [], projects: [], targets: { roles: [], locations: [], industries: [] },
  },
  facts: {}, meta: {}, now: NOW,
});

test("every gap appears exactly once, and no screen is empty", () => {
  // The partition property — the bug-catcher for the theme and split logic.
  const gaps = allGaps();
  const steps = groupIntoSteps(gaps);

  const placed = steps.flatMap((s) => s.fields.map((g) => g.field.id));
  assert.equal(placed.length, gaps.length, "a gap was dropped or duplicated");
  assert.deepEqual([...placed].sort(), gaps.map((g) => g.field.id).sort());
  for (const step of steps) assert.ok(step.fields.length > 0, `${step.id} is empty`);
});

test("no screen the student works through is longer than the cap", () => {
  // The optional tail is exempt on purpose: it is one opt-in list of extras,
  // not a step to work through, and splitting it would add screens rather than
  // remove them.
  const steps = groupIntoSteps(allGaps(), { maxPerStep: 5 });
  for (const step of steps.filter((s) => !s.optional)) {
    assert.ok(step.fields.length <= 5, `${step.id} has ${step.fields.length} questions`);
  }
  assert.ok(steps.some((s) => !s.optional));
});

test("required questions all land on the first screen", () => {
  const gaps = allGaps();
  const steps = groupIntoSteps(gaps);
  const requiredIds = gaps.filter((g) => g.field.required).map((g) => g.field.id);

  const firstScreen = steps[0].fields.map((g) => g.field.id);
  for (const id of requiredIds) {
    assert.ok(firstScreen.includes(id), `${id} is required but not on screen one`);
  }
});

test("a student with two gaps gets one screen, not five", () => {
  const steps = groupIntoSteps(allGaps().slice(0, 2));
  assert.equal(steps.length, 1);
});

test("a student with every gap still gets at most five screens", () => {
  const gaps = allGaps();
  assert.ok(gaps.length > 15, `expected a full questionnaire, got ${gaps.length} gaps`);

  const steps = groupIntoSteps(gaps, { maxSteps: 5 });
  assert.ok(steps.length <= 5, `got ${steps.length} screens`);
  assert.equal(steps[steps.length - 1].optional, true, "the tail screen must be skippable");
});

test("the time estimate is real and readable", () => {
  const steps = groupIntoSteps(allGaps());
  for (const step of steps) assert.ok(step.estimatedSeconds > 0);

  assert.equal(humanEstimate(20), "about 20 seconds");
  assert.equal(humanEstimate(60), "about a minute");
  assert.match(humanEstimate(150), /minutes/);
});

test("progress can be framed as people rather than percent", () => {
  const gaps = computeGaps({
    profile: blankProfile, facts: {}, meta: {}, now: NOW,
    demand: [{ fieldId: "hometown", rank: 5, count: 11, examples: ["Elena is from Richmond"] }],
  });
  const steps = groupIntoSteps(gaps);
  assert.equal(peopleRemaining(steps, 0), 11);
});
