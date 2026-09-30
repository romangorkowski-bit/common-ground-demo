import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, cast, p11, p14, p15, p16, p2, p4, p5, p8, referralCast, student } from "@/lib/affinity/__fixtures__/cast";
import type { Person, ScorableStudent } from "@/lib/affinity/types";
import { affinityGroup } from "./affinity-groups";
import { rankByReferral, scoreReferral } from "./score";

const pool: Person[] = [...cast, ...referralCast];
const rated = rankByReferral(student, pool, { now: NOW });
const of = (p: Person) => rated.find((r) => r.personId === p.id)!;

test("someone who managed the student, now at a target, is a 5", () => {
  assert.equal(of(p14).level, 5);
  assert.equal(of(p14).archetype, "sponsor");
  assert.equal(rated[0].personId, p14.id, "the sponsor leads the list");
});

test("a close academic peer at a target is a 4", () => {
  assert.equal(of(p15).archetype, "peer");
  assert.equal(of(p15).level, 4);
});

test("closure lifts a warm tie to 4, never to 5", () => {
  // Dana: shared org at a target (3), plus Grace and Leah at Deloitte.
  assert.equal(of(p2).archetype, "warm_tie");
  assert.equal(of(p2).level, 4);
  assert.ok(of(p2).adjustments.some((a) => a.delta === 1 && /warm contacts/.test(a.reason)));
  assert.ok(rated.every((r) => r.level < 5 || r.archetype === "sponsor"), "only a sponsor reaches 5");
});

test("without the other Deloitte contacts, the same warm tie stays a 3", () => {
  const alone = scoreReferral(student, p2, [p2], { now: NOW });
  assert.equal(alone.level, 3);
});

test("a recruiter stays at 2 however many warm contacts share the company", () => {
  assert.equal(of(p16).archetype, "recruiter");
  assert.equal(of(p16).level, 2);
  assert.deepEqual(of(p16).adjustments, []);
});

test("a strong hook at a company the student is not targeting is only a 2", () => {
  // Marcus shares an employer (ladder tier 4) but works at Capital One.
  assert.equal(of(p4).archetype, "warm_tie");
  assert.equal(of(p4).atTarget, false);
  assert.equal(of(p4).level, 2);
  assert.equal(of(p5).level, 2);
});

test("too senior for a cold ask drops a level; closure can cancel it", () => {
  // Ruth: recent post at Databricks (3), but a director.
  assert.equal(of(p8).level, 2);
  assert.ok(of(p8).contactSoon, "a recent post says when to write");
  // Harold: tax partner at Deloitte (2): -1 senior, +1 closure, net 2.
  assert.equal(of(p11).level, 2);
  assert.equal(of(p11).adjustments.length, 2);
});

test("with a partner and only a hometown in common, the partner drops a level", () => {
  const partner: Person = { ...p5, id: "partner", currentCompany: "Deloitte", currentTitle: "Audit Partner", currentSeniority: "partner" };
  const r = scoreReferral(student, partner, [partner], { now: NOW });
  assert.equal(r.archetype, "warm_tie");
  assert.equal(r.level, 2);
});

test("an affinity group only counts when both people named it", () => {
  const swe: Person = {
    ...p16, id: "swe", currentTitle: "Consultant", currentSeniority: "associate",
    education: [{ school: "Georgia Tech", degree: "BS", field: "Industrial Engineering", startYear: 2012, endYear: 2016, activities: ["SWE at Georgia Tech"] }],
  };
  // The sample student has named no affinity group: no match, whatever else is true.
  assert.notEqual(scoreReferral(student, swe, [swe], { now: NOW }).archetype, "advocate");

  const member: ScorableStudent = { ...student, facts: { ...student.facts, communities: ["Society of Women Engineers"] } };
  const r = scoreReferral(member, swe, [swe], { now: NOW });
  assert.equal(r.archetype, "advocate");
  assert.equal(r.level, 4);
});

test("affinity groups match by name, not by loose substring", () => {
  assert.equal(affinityGroup("NSBE chapter")?.key, "nsbe");
  assert.equal(affinityGroup("Deloitte Society of Women Engineers network")?.key, "swe");
  assert.equal(affinityGroup("SEO marketing club"), null);
  assert.equal(affinityGroup("Investment Club"), null);
});

test("within a level, the ladder's order holds", () => {
  for (let i = 1; i < rated.length; i += 1) {
    const [a, b] = [rated[i - 1], rated[i]];
    assert.ok(a.level > b.level || (a.level === b.level && a.ladderScore >= b.ladderScore), `${a.personId} before ${b.personId}`);
  }
});

test("with no target companies, nobody is marked down for being elsewhere", () => {
  const open: ScorableStudent = { ...student, facts: { ...student.facts, target_companies: [] } };
  const r = rankByReferral(open, pool, { now: NOW });
  assert.ok(r.every((x) => x.atTarget));
  assert.equal(r.find((x) => x.personId === p4.id)!.level, 3);
});

test("a former manager counts only once the student has confirmed that employer", () => {
  const unconfirmed: ScorableStudent = { ...student, facts: { ...student.facts, prior_employers: [] } };
  const r = scoreReferral(unconfirmed, p14, [p14], { now: NOW });
  assert.notEqual(r.archetype, "sponsor");
});
