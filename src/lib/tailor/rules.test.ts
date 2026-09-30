import assert from "node:assert/strict";
import { test } from "vitest";
import { student } from "@/lib/affinity/__fixtures__/cast";
import { findFabrications } from "@/lib/ai/fabrication-check";
import type { StudentProfile } from "@/lib/ai/schemas";
import { mockPositionsProvider } from "@/lib/positions/mock";
import { analyzeJob } from "./analysis";
import { liveMetrics } from "./refs";
import { hasWeakOpener, metricQuestion, rulesTailor, strengthenOpener } from "./rules";

const positions = await mockPositionsProvider.getPositions({ companies: [], limit: 50 });
const cyberRisk = positions.find((p) => p.id === "m02")!;

const run = (profile: StudentProfile = student.profile, metrics = {}) =>
  rulesTailor({ profile, facts: student.facts, position: cyberRisk, analysis: analyzeJob({ profile, facts: student.facts }, cyberRisk), metrics });

test("the rules tailor claims nothing the profile does not", () => {
  const r = run();
  const known = new Set([...student.profile.skills, ...student.profile.projects.flatMap((p) => p.skills)].map((s) => s.toLowerCase()));
  assert.ok(r.skills.every((s) => known.has(s.toLowerCase())), r.skills.join(", "));
  assert.deepEqual(findFabrications(student.profile, r), []);
  assert.match(r.summary, /Cyber Risk Intern/);
});

test("the posting's skills lead the list", () => {
  assert.equal(run().skills[0], "Python");
});

test("passive openers become action verbs without upgrading the claim", () => {
  assert.equal(strengthenOpener("Responsible for managing the club budget"), "Managed the club budget");
  assert.equal(strengthenOpener("responsible for planning events"), "Planned events");
  assert.equal(strengthenOpener("Was responsible for building a dashboard"), "Built a dashboard");
  assert.equal(strengthenOpener("Helped with onboarding new members"), "Supported onboarding new members");
  // They helped; the rewrite must not say they built it alone.
  assert.equal(strengthenOpener("Helped build the tracker"), "Collaborated to build the tracker");
  assert.equal(strengthenOpener("Worked on a pricing model"), "Collaborated on a pricing model");
  assert.equal(strengthenOpener("cleaned survey data"), "Cleaned survey data");
  assert.ok(hasWeakOpener("Assisted in audits") && !hasWeakOpener(strengthenOpener("Assisted in audits")));
});

test("a bullet with no number gets a question, never an estimate", () => {
  const r = run();
  const prompt = r.metricPrompts.find((m) => m.bulletRef === "exp:0:0");
  assert.ok(prompt, "the internship bullet should be asked about");
  assert.match(prompt!.question, /how many/i);
  assert.ok(r.experience.flatMap((e) => e.bullets).every((b) => !/\d/.test(b)), "no number may appear unasked");
});

test("an answered number lands in its bullet and the question goes away", () => {
  const bullet = student.profile.experience[0].bullets[0];
  const metrics = liveMetrics(student.profile, { "exp:0:0": { value: "1,200", unit: "survey responses", bullet, answeredAt: "" } });
  const r = run(student.profile, metrics);
  assert.match(r.experience[0].bullets[0], /1,200 survey responses/);
  assert.ok(!r.metricPrompts.some((m) => m.bulletRef === "exp:0:0"));
  assert.deepEqual(findFabrications(student.profile, r, metrics), []);
  assert.ok(r.changes.some((c) => c.change === "Added the number you gave"));
});

test("an answer given for a bullet that has since changed is dropped", () => {
  const stale = { "exp:0:0": { value: "40", unit: "reports", bullet: "An older version of the bullet", answeredAt: "" } };
  assert.deepEqual(liveMetrics(student.profile, stale), {});
});

test("the most relevant role moves to the top, with the change logged", () => {
  const profile: StudentProfile = {
    ...student.profile,
    experience: [
      { employer: "Campus Dining", title: "Cashier", start: "2025-09", end: null, location: null, bullets: ["Served students at the register"] },
      ...student.profile.experience,
      { employer: "Audit Club", title: "Treasurer", start: "2025-01", end: null, location: null, bullets: ["Responsible for tracking risk and audit findings"] },
    ],
  };
  const r = run(profile);
  assert.equal(r.experience[0].employer, "Audit Club");
  assert.equal(r.experience[0].bullets[0], "Tracked risk and audit findings");
  assert.ok(r.changes.some((c) => /to the top/.test(c.change)));
  assert.deepEqual(findFabrications(profile, r), []);
});

test("metric questions fit what the bullet did", () => {
  assert.equal(metricQuestion("Led a team of volunteers").unit, "people");
  assert.equal(metricQuestion("Reduced wait times").unit, "percent");
  assert.equal(metricQuestion("Built a tracker").unit, "users");
});
