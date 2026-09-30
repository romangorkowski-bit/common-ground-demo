import { z } from "zod";

export const CourseworkSchema = z.object({
  code: z.string().nullable(),
  title: z.string(),
  grade: z.string().nullable(),
  term: z.string().nullable(),
});

export const ExperienceSchema = z.object({
  employer: z.string(),
  title: z.string(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  location: z.string().nullable(),
  bullets: z.array(z.string()),
});

export const ProjectSchema = z.object({
  name: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
});


/**
 * Affiliation facts that genuinely appear on a resume, under "Activities",
 * "Leadership", "Certifications" or inside an experience bullet. These decide
 * who we introduce the student to, so they are extracted in the same pass as
 * the rest of the profile rather than guessed at later.
 *
 * Deliberately absent: hometown, high school, communities, events, desired
 * transition, target companies. None of those are printed on a resume, so
 * asking the model for them yields nulls at best and invention at worst — and
 * an invented hometown is the worst failure this product has.
 */
export const ResumeAffinitySchema = z.object({
  school_raw: z.string().nullable().describe("The school exactly as the document writes it"),
  majors: z.array(z.string()),
  minors: z.array(z.string()),
  student_orgs: z.array(z.string()).describe("Clubs and student organisations, verbatim"),
  greek: z.array(z.string()).describe("Social and professional Greek letter organisations"),
  case_competitions: z.array(z.string()),
  programs: z.array(z.string()).describe("Named fellowships, scholarships, honours colleges, insight programmes"),
  prior_employers: z.array(z.string()),
  clients_and_programs: z.array(z.string()).describe("Named clients, agencies or internal programmes worked with"),
  certifications_in_progress: z.array(z.string()).describe("Held or in progress; 'studying for' counts"),
});
export type ResumeAffinity = z.infer<typeof ResumeAffinitySchema>;

export const StudentProfileSchema = z.object({
  full_name: z.string().nullable(),
  school: z.string().nullable(),
  grad_date: z.string().nullable().describe("ISO date (YYYY-MM-DD) of expected graduation"),
  work_auth: z.string().nullable(),
  skills: z.array(z.string()),
  coursework: z.array(CourseworkSchema),
  experience: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  targets: z.object({
    roles: z.array(z.string()),
    locations: z.array(z.string()),
    industries: z.array(z.string()),
  }),
  affinity: ResumeAffinitySchema,
  /** Anything the documents contradicted or left ambiguous, for the review screen. */
  uncertainties: z.array(z.string()),
});
export type StudentProfile = z.infer<typeof StudentProfileSchema>;

export const MatchScoreSchema = z.object({
  job_id: z.string(),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const MatchBatchSchema = z.object({ matches: z.array(MatchScoreSchema) });

export const TailoredResumeSchema = z.object({
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      employer: z.string(),
      title: z.string(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  projects: z.array(z.object({ name: z.string(), bullets: z.array(z.string()) })),
  education: z.object({
    school: z.string(),
    credential: z.string().nullable(),
    grad_date: z.string().nullable(),
    highlights: z.array(z.string()),
  }),
  /** Plain-language record of every edit, shown to the student before sending. */
  changes: z.array(
    z.object({
      change: z.string(),
      rationale: z.string(),
      /** The line as the profile has it, and as the resume now has it. Null when the edit is a reorder. */
      before: z.string().nullable(),
      after: z.string().nullable(),
    }),
  ),
  /** Posting keywords worked in because the profile already supports them. Never a new claim. */
  keywordsAdded: z.array(z.string()),
  /**
   * Bullets with no number, and the question that would give them one. The
   * bullet-writer guide wants a metric in every bullet; this app will not
   * invent one, so it asks the student instead.
   */
  metricPrompts: z.array(
    z.object({
      bulletRef: z.string(),
      bullet: z.string(),
      question: z.string(),
      unit: z.string(),
    }),
  ),
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export const NetworkingTargetsSchema = z.object({
  targets: z.array(
    z.object({
      role: z.string(),
      rationale: z.string(),
      search_query: z.string(),
      suggested_message: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});


// --------------------------------------------------------------- affinity

/**
 * Everything the affinity engine scores against. This is the questionnaire's
 * output and the scorer's input, and it is stored as one jsonb column so that
 * adding a question needs no migration.
 *
 * Shape note: this object is byte-for-byte what `scoreAffinity` consumes.
 * Provenance lives in FactsMeta alongside it, never wrapped around these
 * values, so no predicate has to reach through an accessor.
 */
export const IntakeEventSchema = z.object({
  name: z.string(),
  kind: z.enum(["conference", "recruiting_event", "webinar", "case_competition", "class", "career_fair"]),
  date: z.string().describe("ISO date the event happened"),
  org: z.string().nullable(),
});
export type IntakeEvent = z.infer<typeof IntakeEventSchema>;

export const TransitionSchema = z.object({ from: z.string(), to: z.string() });

/**
 * A number the student gave for one bullet ("about 1,200 survey responses").
 * Keyed by bullet ref; `bullet` is the text it was answered for, so an answer
 * is dropped rather than misapplied once a new resume changes that bullet.
 */
export const MetricAnswerSchema = z.object({
  value: z.string(),
  unit: z.string(),
  bullet: z.string(),
  answeredAt: z.string(),
});
export type MetricAnswer = z.infer<typeof MetricAnswerSchema>;

export const AffinityFactsSchema = z.object({
  school_canonical: z.string().nullable(),
  school_grad_year: z.string().nullable(),
  majors: z.array(z.string()),
  minors: z.array(z.string()),
  student_orgs: z.array(z.string()),
  greek: z.array(z.string()),
  case_competitions: z.array(z.string()),
  programs: z.array(z.string()),
  prior_employers: z.array(z.string()),
  clients_and_programs: z.array(z.string()),
  hometown: z.string().nullable(),
  high_school: z.string().nullable(),
  communities: z.array(z.string()),
  technical_domains: z.array(z.string()),
  interests: z.array(z.string()),
  projects_public: z.array(z.string()),
  events: z.array(IntakeEventSchema),
  target_companies: z.array(z.string()),
  target_roles: z.array(z.string()),
  target_function: z.string().nullable(),
  target_seniority: z.string().nullable(),
  desired_transition: TransitionSchema.nullable(),
  certifications_in_progress: z.array(z.string()),
  /** Not an affinity fact: numbers for resume bullets, answered on the resume page. */
  metrics: z.record(z.string(), MetricAnswerSchema).default({}),
});
export type AffinityFacts = z.infer<typeof AffinityFactsSchema>;

/** An empty, fully-shaped facts object. Never mutate it — clone. */
export const EMPTY_FACTS: AffinityFacts = Object.freeze({
  school_canonical: null, school_grad_year: null, majors: [], minors: [],
  student_orgs: [], greek: [], case_competitions: [], programs: [],
  prior_employers: [], clients_and_programs: [], hometown: null, high_school: null,
  communities: [], technical_domains: [], interests: [], projects_public: [],
  events: [], target_companies: [], target_roles: [], target_function: null,
  target_seniority: null, desired_transition: null,
  certifications_in_progress: [], metrics: {},
}) as AffinityFacts;

/**
 * Per-field provenance. The presence of an entry is what makes an empty value
 * an *answer* ("I'm not in any club") rather than a gap — see computeGaps.
 */
export const FactsMetaEntrySchema = z.object({
  source: z.enum(["resume", "answer", "dictation", "derived"]),
  confidence: z.number().min(0).max(1),
  /** The student's own words, kept verbatim when a dictated answer was structured. */
  raw: z.string().nullable(),
  updatedAt: z.string(),
});
export const FactsMetaSchema = z.record(z.string(), FactsMetaEntrySchema);
export type FactsMetaEntry = z.infer<typeof FactsMetaEntrySchema>;
export type FactsMeta = z.infer<typeof FactsMetaSchema>;
