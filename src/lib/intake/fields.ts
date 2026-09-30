import { IN_SCOPE_RANKS, tierWeight } from "@/lib/affinity/tiers";
import { MAJOR_OPTIONS, ROLE_OPTIONS } from "./options";
import type { Field } from "./types";

export const SENIORITY_OPTIONS = [
  "Intern", "Analyst", "Associate", "Senior Associate", "Manager",
] as const;

/**
 * Every question the product can ask, and the only place their copy lives.
 *
 * The questionnaire is COMPUTED, not static: `computeGaps` runs this registry
 * against what the resume already yielded and asks only for what is missing.
 * That is the whole design — a student who lists their clubs on their resume
 * should never be asked about clubs.
 *
 * Ordering is derived from the affinity ladder rather than hand-tuned, so
 * changing the ladder reorders the questionnaire automatically.
 */
export const FIELDS: readonly Field[] = Object.freeze<Field[]>([

  // ------------------------------------------------------------- confirm
  {
    id: "school_canonical", path: "school_canonical", theme: "confirm",
    question: "Where do you go to school?",
    help: "Pick it from the list so “VT” and “Virginia Polytechnic” land in the same place.",
    input: "select", options: "school-canon",
    tiers: [2, 3], resumeDerivable: true, required: true, dictation: false,
  },
  {
    id: "school_grad_year", path: "school_grad_year", theme: "confirm",
    question: "When do you graduate?",
    help: "Month and year is plenty.",
    input: "date",
    tiers: [3, 10], resumeDerivable: true, required: true, dictation: false,
  },
  {
    id: "majors", path: "majors", theme: "confirm",
    question: "What are you studying?",
    help: "Majors and minors.",
    placeholder: "Search majors, or type your own",
    input: "chips", options: MAJOR_OPTIONS, minAnswers: 1,
    tiers: [2, 3], resumeDerivable: true, required: false, dictation: false,
  },

  // -------------------------------------------------------------- campus
  {
    id: "student_orgs", path: "student_orgs", theme: "campus",
    question: "Which clubs or student organizations are you part of?",
    help: "Consulting club, NSBE, the investment fund, student government, marching band — anything with a name.",
    placeholder: "Start typing…",
    input: "chips", options: "org-canon", minAnswers: 1, skipLabel: "I'm not in any",
    tiers: [2], resumeDerivable: true, required: false, dictation: true,
  },
  {
    id: "greek", path: "greek", theme: "campus",
    question: "Are you in a fraternity, sorority, or professional Greek org?",
    help: "Professional ones count — Beta Alpha Psi, Alpha Kappa Psi, Delta Sigma Pi.",
    input: "chips", options: "org-canon", minAnswers: 1, skipLabel: "Not in one",
    tiers: [2], resumeDerivable: true, required: false, dictation: false,
  },
  {
    id: "case_competitions", path: "case_competitions", theme: "campus",
    question: "Any case competitions, hackathons, or competition teams?",
    help: "Name them. “Deloitte Case Competition 2026” opens a conversation; “a case competition” doesn't.",
    input: "chips", minAnswers: 1, skipLabel: "None",
    tiers: [2, 9], resumeDerivable: true, required: false, dictation: true,
  },
  {
    id: "programs", path: "programs", theme: "campus",
    question: "Any named programs, fellowships, or scholarships you've been part of?",
    help: "Management Leadership for Tomorrow, SEO, an honors college, a company's spring insight program.",
    input: "chips", minAnswers: 1, skipLabel: "None",
    tiers: [2, 4], resumeDerivable: true, required: false, dictation: true,
  },

  // ---------------------------------------------------------------- work
  {
    id: "prior_employers", path: "prior_employers", theme: "work",
    question: "Everywhere you've worked or interned — did we get them all?",
    help: "We pulled these off your resume. Add anything missing, including part-time and on-campus jobs.",
    input: "chips", minAnswers: 1,
    tiers: [4], resumeDerivable: true, required: false, dictation: false,
  },
  {
    id: "clients_and_programs", path: "clients_and_programs", theme: "work",
    question: "Did you work with any named clients, agencies, or internal programs?",
    help: "“Supported the CMS engagement”, “worked the Ford account”.",
    input: "chips", minAnswers: 1, skipLabel: "None I can name",
    tiers: [4], resumeDerivable: true, required: false, dictation: true,
  },

  // --------------------------------------------------------------- roots
  {
    id: "hometown", path: "hometown", theme: "roots",
    question: "Where did you grow up?",
    help: "City and state.",
    placeholder: "Richmond, VA",
    input: "text",
    tiers: [5], resumeDerivable: false, required: false, dictation: false,
    // The one place judgement overrides the tier-derived weight: tier 5 is
    // mid-ladder, but this is a two-second answer that unlocks a lot of people.
    weightOverride: 0.8,
  },
  {
    id: "high_school", path: "high_school", theme: "roots",
    question: "Which high school?",
    help: "Optional.",
    input: "text", skipLabel: "Rather not say",
    tiers: [5], resumeDerivable: false, required: false, dictation: false,
  },
  {
    id: "communities", path: "communities", theme: "roots",
    question: "Any communities you're part of outside school?",
    help: "ROTC or military, a church or temple, a hometown youth program, a rec league, a nonprofit you actually show up for.",
    input: "chips", minAnswers: 1, skipLabel: "None",
    tiers: [5], resumeDerivable: false, required: false, dictation: true,
  },

  // --------------------------------------------------------------- craft
  {
    id: "technical_domains", path: "technical_domains", theme: "craft",
    question: "What do you actually work on — specifically?",
    help: "Not “AI”. Something like “retrieval over legal documents” or “credit risk modeling in Python”.",
    placeholder: "responsible AI deployment for public-sector clients",
    input: "chips", minAnswers: 1, specificityMeter: true,
    tiers: [7, 8], resumeDerivable: true, required: false, dictation: true,
  },
  {
    id: "interests", path: "interests", theme: "craft",
    question: "What professional topics do you follow closely?",
    help: "Newsletters you read, talks you'd sit through.",
    input: "chips", minAnswers: 1, specificityMeter: true, skipLabel: "Skip for now",
    tiers: [7, 8, 12], resumeDerivable: false, required: false, dictation: true,
  },
  {
    id: "projects_public", path: "projects_public", theme: "craft",
    question: "Any projects, papers, or repos someone could look up?",
    help: "We use them to find people working on the same problem as you.",
    input: "chips", minAnswers: 1, skipLabel: "Nothing public",
    tiers: [7], resumeDerivable: true, required: false, dictation: true,
  },
  {
    id: "certifications_in_progress", path: "certifications_in_progress", theme: "craft",
    question: "Any certifications, held or in progress?",
    help: "CPA, CFA Level I, AWS, Security+, Databricks. “Currently studying for” counts.",
    input: "chips", minAnswers: 1, skipLabel: "None",
    tiers: [7, 11], resumeDerivable: true, required: false, dictation: false,
  },

  // ------------------------------------------------------------- targets
  // Which COMPANIES the student is going after is deliberately not a question
  // here. The questionnaire is about the person; the company is chosen on the
  // dashboard, one at a time, and written to `target_companies` from there.
  {
    id: "target_roles", path: "target_roles", theme: "targets",
    question: "What roles are you going for?",
    help: "Titles as they'd appear on a posting. Not listed? Type it and press Enter.",
    placeholder: "Search roles, or type your own",
    input: "chips", options: ROLE_OPTIONS, minAnswers: 1,
    tiers: [10, 11], resumeDerivable: true, required: true, dictation: false,
  },
  {
    id: "target_function", path: "target_function", theme: "targets",
    question: "Which function are you heading into?",
    help: "Consulting, software engineering, risk, audit, data. One word is fine.",
    input: "text",
    tiers: [10, 11], resumeDerivable: true, required: false, dictation: false,
  },
  {
    id: "target_seniority", path: "target_seniority", theme: "targets",
    question: "What level are you starting at?",
    help: "We rank people one rung ahead of you highest.",
    input: "select", options: SENIORITY_OPTIONS,
    tiers: [10], resumeDerivable: false, required: false, dictation: false,
  },
  {
    id: "desired_transition", path: "desired_transition", theme: "targets",
    question: "Are you trying to switch into something new?",
    help: "“Accounting to data science”, “engineering to product”.",
    input: "pair", skipLabel: "No, staying on my path",
    tiers: [3], resumeDerivable: false, required: false, dictation: true,
  },

  // -------------------------------------------------------------- timely
  {
    id: "events", path: "events", theme: "timely",
    question: "Been to any recruiting events, conferences, info sessions, or webinars lately?",
    help: "Add the date. These only count for about 72 hours.",
    input: "date-list", minAnswers: 1, skipLabel: "None recently",
    tiers: [9], resumeDerivable: false, required: false, dictation: true,
  },
]);

export const FIELDS_BY_ID: ReadonlyMap<string, Field> = new Map(FIELDS.map((f) => [f.id, f]));

export const fieldById = (id: string): Field | undefined => FIELDS_BY_ID.get(id);

/**
 * A field is worth exactly as much as the best tier it unlocks. Deriving this
 * rather than hand-tuning it means the questionnaire reorders itself whenever
 * the ladder changes, instead of drifting quietly out of step with it.
 */
export function fieldWeight(field: Field): number {
  if (field.weightOverride !== undefined) return field.weightOverride;
  return Math.max(...field.tiers.map(tierWeight));
}

/** Tiers that need something from the student before they can ever fire. */
export const TIERS_NEEDING_A_FACT: readonly number[] =
  IN_SCOPE_RANKS.filter((r) => r !== 13);
