import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { EMPTY_FACTS } from "@/lib/ai/schemas";
import { DEFAULT_WEIGHTS } from "@/lib/homophily/scorer";
import { decodeStudent, encodeStudent } from "./demo-cookie";

const answered = {
  profile: student.profile,
  facts: student.facts,
  meta: { hometown: { source: "answer" as const, confidence: 1, raw: null, updatedAt: "2026-09-19T12:00:00Z" } },
  intakeCompletedAt: "2026-09-19T12:00:00Z",
  email: null,
  homophilyWeights: DEFAULT_WEIGHTS,
};

test("a session survives the round trip through cookies", () => {
  const back = decodeStudent(encodeStudent(answered, student.profile), student.profile)!;
  assert.deepEqual(back.facts, answered.facts);
  assert.equal(back.meta.hometown.source, "answer");
  assert.equal(back.intakeCompletedAt, answered.intakeCompletedAt);
  assert.equal(back.profile.full_name, "Sam Rivera");
});

test("the sample profile is left out, and a replaced one is kept", () => {
  const sampleOnly = encodeStudent(answered, student.profile).join("").length;
  const replaced = { ...answered, profile: { ...student.profile, full_name: "Alex Kim" } };
  const withProfile = encodeStudent(replaced, student.profile);
  assert.ok(withProfile.join("").length > sampleOnly);
  assert.equal(decodeStudent(withProfile, student.profile)!.profile.full_name, "Alex Kim");
});

test("every chunk fits in a cookie", () => {
  // Text that does not compress, so the payload really needs several cookies.
  let seed = 7;
  const noise = (n: number) => Array.from({ length: n }, () => ((seed = (seed * 48271) % 2147483647) % 36).toString(36)).join("");
  const big = { ...answered, profile: { ...student.profile, projects: Array.from({ length: 60 }, (_, i) => ({ name: `Project ${i}`, summary: noise(120), skills: [noise(8)] })) } };
  const chunks = encodeStudent(big, student.profile);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 3800));
  assert.equal(decodeStudent(chunks, student.profile)!.profile.projects.length, 60);
});

test("missing, truncated or foreign cookies read as no session, never a throw", () => {
  assert.equal(decodeStudent([], student.profile), null);
  assert.equal(decodeStudent(["not-a-session"], student.profile), null);
  const chunks = encodeStudent(answered, student.profile);
  assert.equal(decodeStudent([chunks[0].slice(0, 10)], student.profile), null);
});

test("an empty questionnaire is a few hundred bytes", () => {
  const fresh = { ...answered, facts: { ...EMPTY_FACTS }, meta: {}, intakeCompletedAt: null };
  assert.equal(encodeStudent(fresh, student.profile).length, 1);
});
