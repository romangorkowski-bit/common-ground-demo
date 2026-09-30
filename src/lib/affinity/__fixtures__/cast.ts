import { EMPTY_FACTS, type StudentProfile } from "@/lib/ai/schemas";
import type { Person, ScorableStudent } from "../types";

/**
 * One student and eleven people, each engineered so that their PRIMARY tier is
 * exactly one in-scope rung of the ladder. The ordering test and the demo both
 * read this file, which is deliberate: if the demo drifts, the test breaks.
 */

/** Every date here is relative to this, so the fixtures never age. */
export const NOW = Date.parse("2026-09-19T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const profile: StudentProfile = {
  full_name: "Sam Rivera",
  school: "Virginia Tech",
  grad_date: "2027-05-15",
  work_auth: "US citizen",
  skills: ["Python", "Excel", "Power BI"],
  coursework: [{ code: "ECON 4304", title: "Econometrics", grade: "A-", term: "Fall 2026" }],
  experience: [{
    employer: "Blue Ridge Research Group", title: "Research Intern", start: "2026-06", end: "2026-08",
    location: "Blacksburg, VA", bullets: ["Cleaned survey data for a state health agency"],
  }],
  projects: [{ name: "Dining Hall Wait Tracker", summary: "Forecasts dining hall lines from swipe data", skills: ["Python"] }],
  targets: { roles: ["Technology Analyst"], locations: ["Washington, DC"], industries: ["Consulting"] },
  affinity: {
    school_raw: "Virginia Polytechnic Institute and State University",
    majors: ["Economics"], minors: [],
    student_orgs: ["Investment Club"], greek: ["Delta Sigma Pi"],
    case_competitions: ["Hokie Case Challenge"], programs: [],
    prior_employers: ["Blue Ridge Research Group"], clients_and_programs: ["Virginia Department of Health"],
    certifications_in_progress: ["Google Data Analytics Certificate"],
  },
  uncertainties: [],
};

export const student: ScorableStudent = {
  profile,
  facts: {
    ...EMPTY_FACTS,
    school_canonical: "Virginia Tech",
    school_grad_year: "2027-05-15",
    majors: ["Economics"],
    student_orgs: ["Investment Club"],
    greek: ["Delta Sigma Pi"],
    case_competitions: ["Hokie Case Challenge"],
    prior_employers: ["Blue Ridge Research Group"],
    clients_and_programs: ["Virginia Department of Health"],
    hometown: "Norfolk, VA",
    high_school: "Granby High School",
    communities: ["Habitat for Humanity"],
    technical_domains: ["demand forecasting for hospital operations"],
    interests: ["AI"],
    events: [{ name: "Hokie Case Challenge", kind: "case_competition", date: iso(1), org: "Virginia Tech" }],
    target_companies: ["Deloitte", "Databricks"],
    target_roles: ["Technology Analyst"],
    target_function: "consulting",
    target_seniority: "analyst",
    desired_transition: { from: "finance", to: "consulting" },
    certifications_in_progress: ["Google Data Analytics Certificate"],
  },
};

/** Portraits from public/people (randomuser.me set, fetched by databricks/scripts/fetch_portraits.py). */
const PHOTOS: Record<string, string> = {
  p2: "/people/women-44.jpg", p3: "/people/women-68.jpg", p4: "/people/men-32.jpg", p5: "/people/women-21.jpg",
  p7: "/people/men-75.jpg", p8: "/people/women-90.jpg", p9: "/people/men-11.jpg", p10: "/people/women-57.jpg",
  p11: "/people/men-86.jpg", p12: "/people/men-52.jpg", p13: "/people/women-12.jpg",
  p14: "/people/women-33.jpg", p15: "/people/women-51.jpg", p16: "/people/men-40.jpg",
};

/** Defaults so each fixture below states only what makes it interesting. */
const base = (id: string, fullName: string): Person => ({
  id, fullName, headline: null, profileUrl: null, photoUrl: PHOTOS[id] ?? null, email: null,
  currentCompany: "", currentTitle: "", currentFunction: null,
  currentIndustry: null, currentSeniority: null,
  location: null, hometown: null, highSchool: null, communities: [],
  education: [], roles: [], interests: [], projects: [], posts: [], events: [],
  source: "fixture", fetchedAt: iso(0),
});

/** Tier 2 — same university AND the same organisation. */
export const p2: Person = {
  ...base("p2", "Dana Whitfield"),
  currentCompany: "Deloitte", currentTitle: "Audit Manager",
  currentFunction: "audit", currentSeniority: "manager",
  education: [{
    school: "Virginia Polytechnic Institute and State University",
    degree: "BS", field: "Finance", startYear: 2014, endYear: 2018,
    activities: ["Delta Sigma Pi", "Intramural Soccer"],
  }],
  roles: [{
    company: "Deloitte", title: "Audit Manager", function: "audit", industry: null,
    seniority: "manager", startYear: 2018, endYear: null, clients: [], programs: [],
  }],
};

/** Tier 3 — same university AND they already made the student's exact jump. */
export const p3: Person = {
  ...base("p3", "Priya Raman"),
  currentCompany: "Accenture", currentTitle: "Senior Manager, Technology Consulting",
  currentFunction: "consulting", currentSeniority: "senior_manager",
  education: [{
    school: "Virginia Tech", degree: "BS", field: "Computer Science",
    startYear: 2012, endYear: 2016, activities: ["Marching Band"],
  }],
  roles: [
    { company: "Wells Fargo", title: "Financial Analyst", function: "finance", industry: "banking",
      seniority: "analyst", startYear: 2016, endYear: 2019, clients: [], programs: [] },
    { company: "Accenture", title: "Senior Manager, Technology Consulting", function: "consulting",
      industry: null, seniority: "senior_manager", startYear: 2019, endYear: null, clients: [], programs: [] },
  ],
};

/** Tier 4 — a shared employer, with no overlap in time. */
export const p4: Person = {
  ...base("p4", "Marcus Bell"),
  currentCompany: "Capital One", currentTitle: "Analytics Lead",
  currentFunction: "analytics", currentIndustry: "banking", currentSeniority: "manager",
  education: [{ school: "University of Virginia", degree: "BS", field: "Statistics",
    startYear: 2010, endYear: 2014, activities: ["Club Rowing"] }],
  roles: [
    { company: "Blue Ridge Research Group", title: "Data Analyst", function: "analytics", industry: null,
      seniority: "analyst", startYear: 2014, endYear: 2019, clients: [], programs: [] },
    { company: "Capital One", title: "Analytics Lead", function: "analytics", industry: "banking",
      seniority: "manager", startYear: 2019, endYear: null, clients: [], programs: [] },
  ],
};

/** Tier 5 — same hometown, nothing else. */
export const p5: Person = {
  ...base("p5", "Elena Cruz"),
  currentCompany: "Figma", currentTitle: "Product Designer",
  currentFunction: "design", currentSeniority: "senior_associate",
  hometown: "Norfolk, Virginia",
  education: [{ school: "James Madison University", degree: "BFA", field: "Graphic Design",
    startYear: 2013, endYear: 2017, activities: ["Ad Club"] }],
  roles: [{ company: "Figma", title: "Product Designer", function: "design", industry: null,
    seniority: "senior_associate", startYear: 2020, endYear: null, clients: [], programs: [] }],
};

/** Tier 7 — a genuinely specific shared professional interest. */
export const p7: Person = {
  ...base("p7", "Tomás Herrera"),
  currentCompany: "Booz Allen Hamilton", currentTitle: "Lead Data Engineer",
  currentFunction: "data engineering", currentSeniority: "manager",
  interests: ["demand forecasting for hospital operations"],
  education: [{ school: "Georgetown University", degree: "MS", field: "Analytics",
    startYear: 2015, endYear: 2017, activities: [] }],
  roles: [{ company: "Booz Allen Hamilton", title: "Lead Data Engineer", function: "data engineering",
    industry: null, seniority: "manager", startYear: 2017, endYear: null, clients: [], programs: [] }],
};

/** Tier 8 — recently published, and at a company the student is targeting. */
export const p8: Person = {
  ...base("p8", "Ruth Okonjo"),
  currentCompany: "Databricks", currentTitle: "Director of Field Engineering",
  currentFunction: "field engineering", currentSeniority: "director",
  posts: [{
    id: "post-1", kind: "talk", title: "What we got wrong about onboarding new grads",
    excerpt: null, topics: ["hiring"], url: null, publishedAt: iso(3),
  }],
  education: [{ school: "Purdue University", degree: "BS", field: "Industrial Engineering",
    startYear: 2008, endYear: 2012, activities: [] }],
  roles: [{ company: "Databricks", title: "Director of Field Engineering", function: "field engineering",
    industry: null, seniority: "director", startYear: 2021, endYear: null, clients: [], programs: [] }],
};

/** Tier 9 — they were at the same competition, yesterday. */
export const p9: Person = {
  ...base("p9", "Colin Marsh"),
  currentCompany: "Guidehouse", currentTitle: "Risk Associate",
  currentFunction: "risk", currentSeniority: "associate",
  events: [{ name: "Hokie Case Challenge", kind: "case_competition", date: iso(1), org: "Virginia Tech" }],
  education: [{ school: "University of Maryland", degree: "BS", field: "Finance",
    startYear: 2016, endYear: 2020, activities: [] }],
  roles: [{ company: "Guidehouse", title: "Risk Associate", function: "risk", industry: null,
    seniority: "associate", startYear: 2020, endYear: null, clients: [], programs: [] }],
};

/** Tier 10 — exactly one rung ahead, in the student's own function. */
export const p10: Person = {
  ...base("p10", "Ava Lindqvist"),
  currentCompany: "Bain & Company", currentTitle: "Consulting Associate",
  currentFunction: "consulting", currentSeniority: "associate",
  education: [{ school: "New York University", degree: "BA", field: "Economics",
    startYear: 2019, endYear: 2023, activities: [] }],
  roles: [{ company: "Bain & Company", title: "Consulting Associate", function: "consulting",
    industry: null, seniority: "associate", startYear: 2023, endYear: null, clients: [], programs: [] }],
};

/** Tier 11 — a target company, and nothing personal at all. */
export const p11: Person = {
  ...base("p11", "Harold Finch"),
  currentCompany: "Deloitte", currentTitle: "Tax Partner",
  currentFunction: "tax", currentSeniority: "partner",
  education: [{ school: "Ohio State University", degree: "BS", field: "Taxation",
    startYear: 1996, endYear: 2000, activities: [] }],
  roles: [{ company: "Deloitte", title: "Tax Partner", function: "tax", industry: null,
    seniority: "partner", startYear: 2000, endYear: null, clients: [], programs: [] }],
};

/** Tier 12 — "we both like AI", which is exactly as weak as it sounds. */
export const p12: Person = {
  ...base("p12", "Nate Osei"),
  currentCompany: "Scale AI", currentTitle: "Research Lead",
  currentFunction: "research", currentSeniority: "manager",
  interests: ["AI"],
  education: [{ school: "University of Washington", degree: "PhD", field: "Robotics",
    startYear: 2012, endYear: 2018, activities: [] }],
  roles: [{ company: "Scale AI", title: "Research Lead", function: "research", industry: null,
    seniority: "manager", startYear: 2018, endYear: null, clients: [], programs: [] }],
};

/** Tier 13 — nothing in common but a pulse. */
export const p13: Person = {
  ...base("p13", "Jo Ferreira"),
  currentCompany: "Klaviyo", currentTitle: "Brand Marketing Lead",
  currentFunction: "marketing", currentSeniority: "manager",
  education: [{ school: "Boston University", degree: "BA", field: "Communications",
    startYear: 2011, endYear: 2015, activities: [] }],
  roles: [{ company: "Klaviyo", title: "Brand Marketing Lead", function: "marketing", industry: null,
    seniority: "manager", startYear: 2019, endYear: null, clients: [], programs: [] }],
};

/** Shuffled on purpose: a cast already in ladder order proves nothing. */
export const cast: readonly Person[] = [p9, p13, p2, p11, p5, p8, p3, p12, p7, p10, p4];

export const EXPECTED_ORDER = [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13] as const;

// ------------------------------------------------------------ referral cast
//
// Three more people for the referral-likelihood rating (src/lib/referral),
// kept out of `cast` so the ladder test's eleven-rung order is untouched.

/** Referral level 5 — managed the student at Blue Ridge, now at a target company. */
export const p14: Person = {
  ...base("p14", "Grace Kim"),
  currentCompany: "Deloitte", currentTitle: "Senior Consultant",
  currentFunction: "consulting", currentSeniority: "senior_associate",
  education: [{ school: "College of William & Mary", degree: "BA", field: "Economics",
    startYear: 2013, endYear: 2017, activities: [] }],
  roles: [
    { company: "Blue Ridge Research Group", title: "Research Manager", function: "research", industry: null,
      seniority: "manager", startYear: 2021, endYear: 2026, clients: [], programs: [] },
    { company: "Deloitte", title: "Senior Consultant", function: "consulting", industry: null,
      seniority: "senior_associate", startYear: 2026, endYear: null, clients: [], programs: [] },
  ],
};

/** Referral level 4 — same school and major, a year ahead, same professional fraternity. */
export const p15: Person = {
  ...base("p15", "Leah Park"),
  currentCompany: "Deloitte", currentTitle: "Business Analyst",
  currentFunction: "consulting", currentSeniority: "analyst",
  education: [{ school: "Virginia Tech", degree: "BS", field: "Economics",
    startYear: 2022, endYear: 2026, activities: ["Delta Sigma Pi"] }],
  roles: [{ company: "Deloitte", title: "Business Analyst", function: "consulting", industry: null,
    seniority: "analyst", startYear: 2026, endYear: null, clients: [], programs: [] }],
};

/** Referral level 2 — a campus recruiter: the recruiter queue, never the referral tag. */
export const p16: Person = {
  ...base("p16", "Ben Ortiz"),
  currentCompany: "Deloitte", currentTitle: "Campus Recruiter",
  currentFunction: "recruiting", currentSeniority: "associate",
  education: [{ school: "Radford University", degree: "BS", field: "Communication",
    startYear: 2015, endYear: 2019, activities: [] }],
  roles: [{ company: "Deloitte", title: "Campus Recruiter", function: "recruiting", industry: null,
    seniority: "associate", startYear: 2021, endYear: null, clients: [], programs: [] }],
};

export const referralCast: readonly Person[] = [p14, p15, p16];
