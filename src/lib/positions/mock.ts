import { canonical, sameEntity } from "@/lib/affinity/normalize";
import { demoYearShift } from "@/lib/demo-clock";
import type { Position, PositionsProvider, PositionsQuery } from "./types";

/**
 * The stage-safe openings: fifteen postings engineered around the demo student
 * (Virginia Tech, cybersecurity -> consulting, targets Deloitte and Databricks,
 * class of 2027, studying for Security+). Dates are relative to *today* so the
 * timeline never ages: two windows are open now, several open inside 60 days,
 * one is upcoming, one already closed.
 */
const DAY = 86_400_000;
const inDays = (n: number, from = Date.now()) => new Date(from + n * DAY).toISOString().slice(0, 10);

const req = (requirement: string, kind: Position["requirements"][number]["kind"], required = true) =>
  ({ requirement, kind, required });

export function mockPositions(now = Date.now()): Position[] {
  const d = (n: number) => inDays(n, now);
  const base = { source: "mock", location: null as string | null, description: null as string | null, companyId: null as string | null,
    category: null as string | null, datesKnown: true, justPosted: false, requirementsTypical: false };
  // Class years move with the demo student's (see demo-clock.ts), so the
  // postings keep targeting "your class" whatever year the demo is opened.
  const years = demoYearShift(now);
  const postings: Position[] = [
    { ...base, id: "m01", title: "Technology Analyst Intern", company: "Deloitte", type: "internship", vertical: "consulting",
      location: "Arlington, VA", opensOn: d(12), closesOn: d(58), targetGradYears: [2027, 2028], url: "https://jobs.example.com/deloitte/m01",
      description: "Summer analyst on Government & Public Services technology engagements.",
      requirements: [req("Python", "skill"), req("SQL", "skill"), req("Excel modeling", "skill", false), req("Security+", "certification", false), req("Bachelor's in business, economics, or engineering", "degree")] },
    { ...base, id: "m02", title: "Cyber Risk Intern", company: "Deloitte", type: "internship", vertical: "consulting",
      location: "Arlington, VA", opensOn: d(40), closesOn: d(95), targetGradYears: [2027, 2028], url: "https://jobs.example.com/deloitte/m02",
      description: "Cyber Risk practice; clearance-eligible candidates preferred.",
      requirements: [req("Security+", "certification"), req("Python", "skill", false), req("Stakeholder management", "skill", false), req("Prior leadership role in a student org", "experience", false)] },
    { ...base, id: "m03", title: "Solutions Architect Intern", company: "Databricks", type: "internship", vertical: "swe",
      location: "Remote", opensOn: d(-5), closesOn: d(30), targetGradYears: [2027], url: "https://jobs.example.com/databricks/m03",
      description: "Work alongside field engineers on customer data platforms.",
      requirements: [req("SQL", "skill"), req("Python", "skill"), req("Spark", "skill", false), req("Databricks Data Engineer Associate", "certification", false)] },
    { ...base, id: "m04", title: "Software Engineering Intern", company: "Databricks", type: "internship", vertical: "swe",
      location: "San Francisco, CA", opensOn: d(55), closesOn: d(110), targetGradYears: [2027, 2028], url: "https://jobs.example.com/databricks/m04",
      requirements: [req("Java", "skill"), req("Distributed Systems", "skill", false), req("Git", "skill"), req("BS in Computer Science or related", "degree")] },
    { ...base, id: "m05", title: "Applied ML Research Intern", company: "Databricks", type: "research", vertical: "swe",
      location: "Remote", opensOn: d(130), closesOn: d(190), targetGradYears: [2027, 2028, 2029], url: "https://jobs.example.com/databricks/m05",
      requirements: [req("Python", "skill"), req("Machine Learning", "skill"), req("PyTorch", "skill", false)] },
    { ...base, id: "m06", title: "Technology Consulting Summer Analyst", company: "Accenture", type: "internship", vertical: "consulting",
      location: "Washington, DC", opensOn: d(21), closesOn: d(70), targetGradYears: [2027, 2028], url: "https://jobs.example.com/accenture/m06",
      requirements: [req("Case interviews", "skill", false), req("PowerPoint", "skill"), req("SQL", "skill", false)] },
    { ...base, id: "m07", title: "Federal Technology Analyst (New Grad)", company: "Booz Allen Hamilton", type: "full_time", vertical: "consulting",
      location: "McLean, VA", opensOn: d(95), closesOn: d(160), targetGradYears: [2027], url: "https://jobs.example.com/booz/m07",
      requirements: [req("Security+", "certification"), req("Python", "skill", false), req("Bachelor's in business, economics, or engineering", "degree")] },
    { ...base, id: "m08", title: "Analytics Intern", company: "Capital One", type: "internship", vertical: "finance",
      location: "Richmond, VA", opensOn: d(-20), closesOn: d(10), targetGradYears: [2027, 2028], url: "https://jobs.example.com/capitalone/m08",
      requirements: [req("SQL", "skill"), req("Tableau", "skill", false), req("Statistics", "skill", false)] },
    { ...base, id: "m09", title: "Public Sector Analyst Intern", company: "Guidehouse", type: "internship", vertical: "consulting",
      location: "Washington, DC", opensOn: d(33), closesOn: d(80), targetGradYears: [2027, 2028], url: "https://jobs.example.com/guidehouse/m09",
      requirements: [req("Excel modeling", "skill"), req("PowerPoint", "skill"), req("Lean Six Sigma Green Belt", "certification", false)] },
    { ...base, id: "m10", title: "Security Engineering Intern", company: "MITRE", type: "internship", vertical: "swe",
      location: "McLean, VA", opensOn: d(8), closesOn: d(50), targetGradYears: [2027, 2028], url: "https://jobs.example.com/mitre/m10",
      requirements: [req("Security+", "certification"), req("Linux", "skill"), req("Python", "skill")] },
    { ...base, id: "m11", title: "Strategy Consulting Intern", company: "Bain & Company", type: "internship", vertical: "consulting",
      location: "Boston, MA", opensOn: d(-60), closesOn: d(-15), targetGradYears: [2027], url: "https://jobs.example.com/bain/m11",
      requirements: [req("Case interviews", "skill"), req("Market sizing", "skill"), req("Excel modeling", "skill")] },
    { ...base, id: "m12", title: "Data Engineering Intern", company: "Databricks", type: "internship", vertical: "swe",
      location: "Seattle, WA", opensOn: d(70), closesOn: d(120), targetGradYears: [2028, 2029], url: "https://jobs.example.com/databricks/m12",
      requirements: [req("SQL", "skill"), req("Spark", "skill"), req("Python", "skill")] },
    { ...base, id: "m13", title: "Operations Research Intern", company: "Deloitte", type: "research", vertical: "consulting",
      location: "Remote", opensOn: d(150), closesOn: d(200), targetGradYears: [2027, 2028, 2029], url: "https://jobs.example.com/deloitte/m13",
      requirements: [req("Python", "skill"), req("Statistics", "skill"), req("Tableau", "skill", false)] },
    { ...base, id: "m14", title: "Investment Banking Summer Analyst", company: "Greystone Investment Bank", type: "internship", vertical: "finance",
      location: "New York, NY", opensOn: d(15), closesOn: d(45), targetGradYears: [2027, 2028], url: "https://jobs.example.com/greystone/m14",
      requirements: [req("Financial modeling", "skill"), req("Excel modeling", "skill"), req("Bloomberg Market Concepts", "certification", false)] },
    { ...base, id: "m15", title: "Business Analyst (New Grad)", company: "Deloitte", type: "full_time", vertical: "consulting",
      location: "Arlington, VA", opensOn: d(110), closesOn: d(170), targetGradYears: [2027], url: "https://jobs.example.com/deloitte/m15",
      requirements: [req("Excel modeling", "skill"), req("PowerPoint", "skill"), req("Case interviews", "skill", false), req("Bachelor's in business, economics, or engineering", "degree")] },
  ];
  return years === 0 ? postings : postings.map((p) => ({ ...p, targetGradYears: p.targetGradYears.map((y) => y + years) }));
}

export const mockPositionsProvider: PositionsProvider = {
  name: "mock",
  async getPositions({ companies, limit }: PositionsQuery): Promise<Position[]> {
    const all = mockPositions();
    if (!companies.length) return all.slice(0, limit);
    const wanted = companies.map((c) => canonical("company", c));
    const matched = all.filter((p) => wanted.some((w) => sameEntity("company", w, canonical("company", p.company))));
    const rest = all.filter((p) => !matched.includes(p));
    return [...matched, ...rest].slice(0, limit);
  },
};
