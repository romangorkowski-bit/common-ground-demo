import assert from "node:assert/strict";
import { test } from "vitest";
import { EMPTY_FACTS, type FactsMeta } from "@/lib/ai/schemas";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { applyAnswers, skipAnswer } from "./answers";
import { computeGaps } from "./gaps";
import { FIELDS } from "./fields";

const NOW = Date.parse("2026-09-19T12:00:00Z");
const ISO = new Date(NOW).toISOString();
const blank = {
  ...student.profile,
  uncertainties: [],
  affinity: {
    school_raw: null, majors: [], minors: [], student_orgs: [], greek: [],
    case_competitions: [], programs: [], prior_employers: [],
    clients_and_programs: [], certifications_in_progress: [],
  },
  experience: [], projects: [], targets: { roles: [], locations: [], industries: [] },
};

test("the questionnaire terminates when every question is answered with a skip", () => {
  // If this ever loops, the student can never finish intake — which is the
  // worst bug this module can have.
  let facts = { ...EMPTY_FACTS };
  let meta: FactsMeta = {};

  for (let round = 0; round < 10; round += 1) {
    const gaps = computeGaps({ profile: blank, facts, meta, now: NOW });
    if (!gaps.length) {
      assert.ok(round > 0, "expected at least one round of questions");
      return;
    }
    const answers = gaps.map((g) => {
      const skip = skipAnswer(g.field);
      // Required fields have no skip, so answer them with something plausible.
      if (!g.field.required) return skip;
      return {
        ...skip,
        value: g.field.input === "chips" ? ["Placeholder", "Two", "Three"] : "Virginia Tech",
      };
    });
    ({ facts, meta } = applyAnswers(facts, meta, answers, ISO));
  }
  assert.fail("computeGaps never reached zero — the questionnaire does not terminate");
});

test("answers merge, leaving untouched fields alone", () => {
  const first = applyAnswers({ ...EMPTY_FACTS }, {}, [
    { fieldId: "hometown", value: "Richmond, VA", source: "answer" },
  ], ISO);
  const second = applyAnswers(first.facts, first.meta, [
    { fieldId: "high_school", value: "Deep Run High School", source: "answer" },
  ], ISO);

  assert.equal(second.facts.hometown, "Richmond, VA");
  assert.equal(second.facts.high_school, "Deep Run High School");
  assert.ok(second.meta.hometown, "earlier provenance must survive");
});

test("an unknown field is refused rather than silently dropped", () => {
  assert.throws(
    () => applyAnswers({ ...EMPTY_FACTS }, {}, [{ fieldId: "favourite_colour", value: "blue", source: "answer" }]),
    /Unknown intake field/,
  );
});

test("a dictated answer keeps the student's own words", () => {
  const raw = "um, I was in, uh, Beta Alpha Psi and also the consulting club";
  const { facts, meta } = applyAnswers({ ...EMPTY_FACTS }, {}, [{
    fieldId: "student_orgs", value: ["Beta Alpha Psi", "Consulting Club"],
    source: "dictation", confidence: 0.8, raw,
  }], ISO);

  assert.deepEqual(facts.student_orgs, ["Beta Alpha Psi", "Consulting Club"]);
  assert.equal(meta.student_orgs.raw, raw);
  assert.equal(meta.student_orgs.source, "dictation");
});

test("chips are trimmed and de-duplicated", () => {
  const { facts } = applyAnswers({ ...EMPTY_FACTS }, {}, [
    { fieldId: "majors", value: ["Finance", " finance ", "", "Accounting"], source: "answer" },
  ], ISO);
  assert.deepEqual(facts.majors, ["Finance", "Accounting"]);
});

test("a skip writes the right kind of empty for every field", () => {
  for (const field of FIELDS) {
    if (!field.skipLabel) continue;
    const { facts } = applyAnswers({ ...EMPTY_FACTS }, {}, [skipAnswer(field)], ISO);
    const value = facts[field.path];
    assert.ok(value === null || (Array.isArray(value) && value.length === 0),
      `${field.id} skipped to ${JSON.stringify(value)}`);
  }
});
