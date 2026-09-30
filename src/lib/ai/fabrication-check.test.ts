import assert from "node:assert/strict";
import { test } from "vitest";
import { findFabrications } from "./fabrication-check";
import type { StudentProfile, TailoredResume } from "./schemas";

const profile: StudentProfile = {
  full_name: "Sam Rivera", school: "Virginia Tech", grad_date: "2027-05-15",
  work_auth: "US citizen",
  skills: ["Python", "Excel", "Power BI"],
  coursework: [{ code: "ECON 4304", title: "Econometrics", grade: "A-", term: "Fall 2026" }],
  experience: [{
    employer: "Blue Ridge Research Group", title: "Research Intern", start: "2026-06", end: "2026-08",
    location: "Blacksburg, VA", bullets: ["Cleaned survey data"],
  }],
  projects: [{ name: "Dining Hall Wait Tracker", summary: "Forecasts dining hall lines", skills: ["Python"] }],
  targets: { roles: ["Data Analyst"], locations: ["DC"], industries: ["Consulting"] },
  affinity: {
    school_raw: "Virginia Tech", majors: ["Economics"], minors: [],
    student_orgs: ["Investment Club"], greek: ["Delta Sigma Pi"], case_competitions: [],
    programs: [], prior_employers: ["Blue Ridge Research Group"], clients_and_programs: [],
    certifications_in_progress: [],
  },
  uncertainties: [],
};

const baseResume: TailoredResume = {
  summary: "Analytics-focused student.",
  skills: ["Python", "Excel"],
  experience: [{
    employer: "Blue Ridge Research Group", title: "Research Intern",
    start: "2026-06", end: "2026-08", bullets: ["Rebuilt survey reporting in Power BI"],
  }],
  projects: [{ name: "Dining Hall Wait Tracker", bullets: ["Modelled dining hall lines"] }],
  education: { school: "Virginia Tech", credential: "BS", grad_date: "2027-05-15", highlights: [] },
  changes: [],
  keywordsAdded: [],
  metricPrompts: [],
};

test("a faithfully tailored resume raises nothing", () => {
  assert.deepEqual(findFabrications(profile, baseResume), []);
});

test("rewording bullets is allowed — that is what tailoring is", () => {
  const reworded = {
    ...baseResume,
    experience: [{ ...baseResume.experience[0], bullets: ["Totally different phrasing here"] }],
  };
  assert.deepEqual(findFabrications(profile, reworded), []);
});

test("catches an invented employer", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], employer: "Goldman Sachs" }] };
  const found = findFabrications(profile, bad);
  assert.equal(found.length, 1);
  assert.equal(found[0].field, "experience.employer");
});

test("catches an inflated job title at a real employer", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], title: "Lead Data Scientist" }] };
  assert.equal(findFabrications(profile, bad)[0].field, "experience.title");
});

test("catches stretched employment dates", () => {
  const bad = { ...baseResume, experience: [{ ...baseResume.experience[0], start: "2025-01" }] };
  const found = findFabrications(profile, bad);
  assert.equal(found[0].field, "experience.start");
  assert.match(found[0].detail, /2026-06/);
});

test("catches a skill added because the posting asked for it", () => {
  const bad = { ...baseResume, skills: ["Python", "Kubernetes"] };
  const found = findFabrications(profile, bad);
  assert.equal(found.length, 1);
  assert.equal(found[0].value, "Kubernetes");
});

test("accepts a skill evidenced by coursework or a project", () => {
  const ok = { ...baseResume, skills: ["Power BI", "Econometrics"] };
  assert.deepEqual(findFabrications(profile, ok), []);
});

test("catches an invented project and a wrong school", () => {
  const bad = {
    ...baseResume,
    projects: [{ name: "Autonomous Drone Fleet", bullets: [] }],
    education: { ...baseResume.education, school: "MIT" },
  };
  const fields = findFabrications(profile, bad).map((f) => f.field);
  assert.deepEqual(fields.sort(), ["education.school", "projects.name"]);
});

test("catches a metric the profile never had", () => {
  const bad = {
    ...baseResume,
    experience: [{ ...baseResume.experience[0], bullets: ["Cleaned survey data, cutting errors by 40%"] }],
  };
  const found = findFabrications(profile, bad);
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /^40 /);
});

test("a number the student answered is allowed", () => {
  const withAnswer = {
    ...baseResume,
    experience: [{ ...baseResume.experience[0], bullets: ["Cleaned 1,200 survey responses"] }],
  };
  const metrics = { "exp:0:0": { value: "1,200", unit: "survey responses", bullet: "Cleaned survey data", answeredAt: "" } };
  assert.deepEqual(findFabrications(profile, withAnswer, metrics), []);
  assert.equal(findFabrications(profile, withAnswer).length, 1);
});

test("dates and years already on the profile are not flagged as metrics", () => {
  const ok = { ...baseResume, summary: "Economics student graduating in 2027." };
  assert.deepEqual(findFabrications(profile, ok), []);
});

test("catches a keyword the profile does not support", () => {
  const bad = { ...baseResume, keywordsAdded: ["Python", "Stakeholder management"] };
  const found = findFabrications(profile, bad);
  assert.deepEqual(found.map((f) => f.value), ["Stakeholder management"]);
});
