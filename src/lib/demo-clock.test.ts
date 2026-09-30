import assert from "node:assert/strict";
import { test } from "vitest";
import { NOW, cast, referralCast } from "@/lib/affinity/__fixtures__/cast";
import { currentCast } from "@/lib/people/mock";
import { mockPositions } from "@/lib/positions/mock";
import { demoGradYear, demoYearShift, shiftYear } from "./demo-clock";

const DAY = 86_400_000;

test("on the day the fixtures were written nothing moves", () => {
  assert.equal(demoYearShift(NOW), 0);
  assert.deepEqual(currentCast(NOW), [...cast, ...referralCast]);
});

test("a year later a post is exactly as old as it was", () => {
  const later = NOW + 365 * DAY;
  const withPost = cast.findIndex((p) => p.posts.length > 0);
  const age = (now: number, people = currentCast(now)) => now - Date.parse(people[withPost].posts[0].publishedAt);
  assert.equal(age(later), age(NOW));
});

test("the sample student is always recruiting for next summer", () => {
  assert.equal(demoGradYear(Date.parse("2026-09-19T00:00:00Z")), 2027);
  assert.equal(demoGradYear(Date.parse("2027-03-01T00:00:00Z")), 2027);
  assert.equal(demoGradYear(Date.parse("2027-09-01T00:00:00Z")), 2028);
  assert.equal(shiftYear("2027-05-15", 2), "2029-05-15");
});

test("mock postings target the shifted class year", () => {
  const nextYear = Date.parse("2027-09-01T00:00:00Z");
  const now = mockPositions(NOW).find((p) => p.id === "m01")!;
  const later = mockPositions(nextYear).find((p) => p.id === "m01")!;
  assert.deepEqual(later.targetGradYears, now.targetGradYears.map((y) => y + 1));
});
