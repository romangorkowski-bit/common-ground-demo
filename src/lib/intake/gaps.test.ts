import assert from "node:assert/strict";
import { test } from "vitest";
import { EMPTY_FACTS, type FactsMeta, type StudentProfile } from "@/lib/ai/schemas";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { computeGaps } from "./gaps";
import { fieldById } from "./fields";

const NOW = Date.parse("2026-09-19T12:00:00Z");
const DAY = 86_400_000;

const profileWith = (over: Partial<StudentProfile["affinity"]>, uncertainties: string[] = []): StudentProfile => ({
  ...student.profile,
  affinity: { ...student.profile.affinity, ...over },
  uncertainties,
});

const answered = (confidence = 1): FactsMeta[string] => ({
  source: "answer", confidence, raw: null, updatedAt: new Date(NOW).toISOString(),
});

const gapIds = (gaps: ReturnType<typeof computeGaps>) => gaps.map((g) => g.field.id);

test("a resume that lists clubs is not asked about clubs", () => {
  const withClubs = computeGaps({
    profile: profileWith({ student_orgs: ["Consulting Club"] }),
    facts: {}, meta: { student_orgs: answered() }, now: NOW,
  });
  assert.ok(!gapIds(withClubs).includes("student_orgs"));

  const withoutClubs = computeGaps({
    profile: profileWith({ student_orgs: [] }),
    facts: {}, meta: {}, now: NOW,
  });
  const gap = withoutClubs.find((g) => g.field.id === "student_orgs");
  assert.ok(gap);
  assert.equal(gap!.reason, "absent");
});

test("answering 'none' is an answer, and the question never comes back", () => {
  // The single subtlest rule in the module. Without it the questionnaire nags
  // a student who has no Greek life forever.
  const skipped = computeGaps({
    profile: profileWith({ greek: [] }),
    facts: { ...EMPTY_FACTS, greek: [] },
    meta: { greek: answered() },
    now: NOW,
  });
  assert.ok(!gapIds(skipped).includes("greek"), "an explicit 'none' must be respected");

  const neverAsked = computeGaps({
    profile: profileWith({ greek: [] }),
    facts: { ...EMPTY_FACTS, greek: [] },
    meta: {},
    now: NOW,
  });
  assert.ok(gapIds(neverAsked).includes("greek"), "an empty value with no meta is still a gap");
});

test("a low-confidence extraction is re-asked with its value prefilled", () => {
  const gaps = computeGaps({
    profile: profileWith({ programs: ["Honors College"] }),
    facts: { ...EMPTY_FACTS, programs: ["Honors College"] },
    meta: { programs: { source: "resume", confidence: 0.4, raw: null, updatedAt: "" } },
    now: NOW,
  });
  const gap = gaps.find((g) => g.field.id === "programs");
  assert.ok(gap);
  assert.equal(gap!.reason, "low_confidence");
  assert.deepEqual(gap!.prefill, ["Honors College"]);
});

test("the extractor's own uncertainty jumps the queue and carries its words", () => {
  const note = "Listed 'BAP' under activities — could be Beta Alpha Psi, but the document does not say.";
  const gaps = computeGaps({
    profile: profileWith({ student_orgs: ["BAP"] }, [note]),
    facts: {}, meta: {}, now: NOW,
  });

  const gap = gaps.find((g) => g.field.id === "student_orgs");
  assert.ok(gap);
  assert.equal(gap!.reason, "flagged_uncertain");
  assert.equal(gap!.uncertaintyNote, note);

  const optional = gaps.filter((g) => !g.field.required && g.reason !== "flagged_uncertain");
  for (const other of optional) {
    assert.ok(gap!.priority > other.priority, `${other.field.id} outranked a flagged uncertainty`);
  }
});

test("the school is confirmed exactly once, however confident we were", () => {
  const first = computeGaps({ profile: profileWith({}), facts: {}, meta: {}, now: NOW });
  const gap = first.find((g) => g.field.id === "school_canonical");
  assert.ok(gap);
  assert.equal(gap!.reason, "confirm");
  assert.ok(gap!.prefill, "it should arrive prefilled, not blank");

  const after = computeGaps({
    profile: profileWith({}),
    facts: { ...EMPTY_FACTS, school_canonical: "Virginia Tech" },
    meta: { school_canonical: answered() },
    now: NOW,
  });
  assert.ok(!gapIds(after).includes("school_canonical"));
});

test("events that have aged out come back as stale, not as never-asked", () => {
  const stale = computeGaps({
    profile: profileWith({}),
    facts: {
      ...EMPTY_FACTS,
      events: [{ name: "Fall Career Fair", kind: "career_fair", date: new Date(NOW - 9 * DAY).toISOString(), org: null }],
    },
    meta: { events: answered() },
    now: NOW,
  });
  const gap = stale.find((g) => g.field.id === "events");
  assert.ok(gap);
  assert.equal(gap!.reason, "stale");
});

test("real demand promotes a question above an equally weighted one", () => {
  const base = computeGaps({ profile: profileWith({}), facts: {}, meta: {}, now: NOW });
  const boosted = computeGaps({
    profile: profileWith({}), facts: {}, meta: {}, now: NOW,
    demand: [{ fieldId: "high_school", rank: 5, count: 14, examples: ["Ruth went to Deep Run"] }],
  });

  const rank = (gaps: typeof base, id: string) => gaps.findIndex((g) => g.field.id === id);
  assert.ok(rank(boosted, "high_school") < rank(base, "high_school"));
  const gap = boosted.find((g) => g.field.id === "high_school")!;
  assert.equal(gap.demandCount, 14);
  assert.deepEqual(gap.demandExamples, ["Ruth went to Deep Run"]);
});

test("optional questions are ordered by the ladder", () => {
  const gaps = computeGaps({ profile: profileWith({}), facts: {}, meta: {}, now: NOW })
    .filter((g) => !g.field.required && g.reason !== "flagged_uncertain");
  const at = (id: string) => gaps.findIndex((g) => g.field.id === id);
  assert.ok(at("student_orgs") < at("communities"), "tier 2 should precede tier 5");
  assert.ok(at("communities") < at("interests"), "tier 5 should precede tier 12");
});

test("computing gaps is deterministic", () => {
  const args = { profile: profileWith({}), facts: {}, meta: {} as FactsMeta, now: NOW };
  assert.deepEqual(computeGaps(args), computeGaps(args));
});

test("a field that is not resume-derivable is never silently prefilled", () => {
  const gaps = computeGaps({ profile: profileWith({}), facts: {}, meta: {}, now: NOW });
  for (const gap of gaps) {
    if (!gap.field.resumeDerivable) {
      assert.equal(gap.prefill, null, `${gap.field.id} was prefilled from a resume it cannot appear on`);
    }
  }
  assert.equal(fieldById("hometown")!.resumeDerivable, false);
});

test("an uncertainty about an on-campus job is not mistaken for one about the school", () => {
  // "campus" is too loose a token to route on: the note below is about
  // overlapping employment dates, and putting it under "where do you go to
  // school?" reads as a bug to the student.
  const note = "Two end dates overlap in summer 2026 — the Acme internship and the campus job may have run at the same time.";
  const gaps = computeGaps({
    profile: profileWith({}, [note]), facts: {}, meta: {}, now: NOW,
  });
  assert.equal(gaps.find((g) => g.field.id === "school_canonical")?.uncertaintyNote, null);
  assert.equal(gaps.find((g) => g.field.id === "prior_employers")?.uncertaintyNote, note);
});
