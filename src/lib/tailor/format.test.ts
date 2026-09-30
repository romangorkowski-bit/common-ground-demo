import assert from "node:assert/strict";
import { test } from "vitest";
import type { TailoredResume } from "@/lib/ai/schemas";
import { monthYear } from "./dates";
import { formatCheck } from "./format";
import { renderResumePdf, resumeFileName } from "./pdf";
import { pdfToText } from "@/lib/resume/pdf-text";

const resume: TailoredResume = {
  summary: "Analyst candidate: Economics student at Virginia Tech, graduating May 2027.",
  skills: ["Python", "Excel"],
  experience: [{
    employer: "Blue Ridge Research Group", title: "Research Intern", start: "2026-06", end: "2026-08",
    bullets: ["Cleaned 1,200 survey responses", "Built a Power BI report used by 4 analysts", "Presented results to 12 staff"],
  }],
  projects: [{ name: "Dining Hall Wait Tracker", bullets: ["Forecasts dining hall lines from swipe data"] }],
  education: { school: "Virginia Tech", credential: "Economics", grad_date: "2027-05-15", highlights: ["Relevant coursework: Econometrics"] },
  changes: [], keywordsAdded: [], metricPrompts: [],
};
const header = { name: "Sam Rivera", contact: ["sam@example.edu"] };
const status = (checks: ReturnType<typeof formatCheck>, id: string) => checks.find((c) => c.id === id)?.status;

test("a clean resume renders to one text-based page an ATS can read", async () => {
  const { bytes, pages } = await renderResumePdf(resume, header);
  assert.equal(pages, 1);
  const text = await pdfToText(bytes).catch(() => "");
  // pdfToText refuses very short documents; this one clears its floor.
  assert.match(text, /SUMMARY/);
  assert.match(text, /EXPERIENCE/);
  assert.match(text, /Jun 2026 – Aug 2026/);
  assert.match(text, /Cleaned 1,200 survey responses/);
  const checks = formatCheck(resume, { pages, name: "Sam Rivera", contact: header.contact });
  assert.ok(checks.every((c) => c.status !== "fail"), JSON.stringify(checks.filter((c) => c.status === "fail")));
});

test("a nine-bullet role fails, as does a second page", async () => {
  const bloated: TailoredResume = {
    ...resume,
    experience: [{ ...resume.experience[0], bullets: Array.from({ length: 9 }, (_, i) => `Reconciled ledger batch ${i + 1} against the bank statement`) }],
  };
  assert.equal(status(formatCheck(bloated, { pages: 1, name: "Sam", contact: [] }), "bullet-count"), "fail");

  const long: TailoredResume = {
    ...resume,
    experience: Array.from({ length: 12 }, (_, i) => ({ ...resume.experience[0], employer: `Employer ${i}`, bullets: resume.experience[0].bullets.concat(resume.experience[0].bullets) })),
  };
  const { pages } = await renderResumePdf(long, header);
  assert.ok(pages > 1);
  assert.equal(status(formatCheck(long, { pages, name: "Sam", contact: [] }), "one-page"), "fail");
});

test("passive openers and bare bullets are flagged", () => {
  const weak: TailoredResume = { ...resume, experience: [{ ...resume.experience[0], bullets: ["Responsible for data entry", "Cleaned survey data"] }] };
  const checks = formatCheck(weak, { pages: 1, name: "Sam", contact: [] });
  assert.equal(status(checks, "action-verbs"), "fail");
  assert.equal(status(checks, "metrics"), "warn");
  assert.equal(status(checks, "header"), "warn");
});

test("characters the standard font cannot encode do not break the PDF", async () => {
  const odd = { ...resume, summary: "Built a tracker → used daily ✓ by students 🚀" };
  const { pages } = await renderResumePdf(odd, header);
  assert.equal(pages, 1);
});

test("dates and file names follow the guides", () => {
  assert.equal(monthYear("2026-06"), "Jun 2026");
  assert.equal(monthYear("2027-05-15"), "May 2027");
  assert.equal(monthYear("September 2025"), "Sep 2025");
  assert.equal(monthYear("sometime"), null);
  assert.equal(resumeFileName("Sam Rivera", "Cyber Risk Intern", "Deloitte"), "Rivera_Sam_Resume_CyberRiskIntern_Deloitte.pdf");
});
