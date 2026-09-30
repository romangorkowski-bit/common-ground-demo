import type { AffinityFacts } from "@/lib/ai/schemas";

export type InputType =
  | "chips" | "text" | "longtext" | "date" | "select" | "date-list" | "pair";

/**
 * Screens are grouped by theme rather than by importance alone: five related
 * questions read as a conversation, five unrelated ones read as a form and get
 * abandoned halfway.
 */
export type Theme = "confirm" | "campus" | "work" | "roots" | "craft" | "targets" | "timely";

export const THEME_ORDER: readonly Theme[] = [
  "confirm", "campus", "work", "roots", "craft", "targets", "timely",
];

export const THEME_COPY: Readonly<Record<Theme, { title: string; subtitle: string }>> = {
  confirm: { title: "Let's confirm what we read", subtitle: "We pulled this off your resume. Correct anything we got wrong." },
  campus:  { title: "Your campus life", subtitle: "This is where the strongest connections come from — more than anything else on here." },
  work:    { title: "Where you've worked", subtitle: "Shared work context is a credible reason to write to someone you've never met." },
  roots:   { title: "Where you're from", subtitle: "The most underrated section here. People answer messages from home." },
  craft:   { title: "What you actually work on", subtitle: "The narrower you go, the better the person we can find you." },
  targets: { title: "Where you're headed", subtitle: "Roles and level only. You pick companies on your dashboard, after this." },
  timely:  { title: "Anything recent", subtitle: "Some connections only stay open for a few days." },
};

/** Option sources resolved at render time against the canonical alias tables. */
export type OptionSource = "school-canon" | "org-canon" | "seniority" | "function";

export type { OptionGroup } from "./options";

export interface Field {
  id: string;
  /** Which AffinityFacts key this writes. */
  path: keyof AffinityFacts;
  /** Student-facing. Always a question, always ends in "?". */
  question: string;
  /** One line underneath, explaining why we're asking. */
  help: string;
  placeholder?: string;
  input: InputType;
  options?: OptionSource | readonly string[] | readonly import("./options").OptionGroup[];
  /** Which affinity tiers this field unlocks. Drives ordering. */
  tiers: readonly number[];
  theme: Theme;
  /** Can the resume extractor fill this? */
  resumeDerivable: boolean;
  required: boolean;
  /** Show a microphone on this field. */
  dictation: boolean;
  minAnswers?: number;
  /**
   * The explicit-negative button. Its ABSENCE means there is no honest way to
   * answer "none" — a student always has a school.
   */
  skipLabel?: string;
  /** Show the live specificity meter (tier-7 fields only). */
  specificityMeter?: boolean;
  /**
   * Overrides the tier-derived weight. Exists for exactly one field, and that
   * is deliberate — see `hometown`.
   */
  weightOverride?: number;
}

export type GapReason =
  | "absent"            // never asked, no value
  | "empty"             // value empty and no explicit skip recorded
  | "confirm"           // derived from the resume, must be seen once
  | "low_confidence"    // meta.confidence below the bar
  | "flagged_uncertain" // the extractor itself said it wasn't sure
  | "below_min"         // a chips field under minAnswers, with no skip
  | "stale";            // time-sensitive value has aged out

export interface Gap {
  field: Field;
  reason: GapReason;
  prefill: unknown | null;
  /** Tiers this answer would unlock. */
  unlocks: readonly number[];
  /** How many real people this would actually promote. */
  demandCount: number;
  /** A couple of those people, for the question's subtitle. */
  demandExamples: readonly string[];
  priority: number;
  /** The extractor's own words, shown inline when it flagged this. */
  uncertaintyNote: string | null;
}

export interface IntakeStep {
  id: string;
  title: string;
  subtitle: string;
  fields: Gap[];
  /**
   * Shown to the student. "About 40 seconds" cuts abandonment considerably
   * more than a progress bar does.
   */
  estimatedSeconds: number;
  optional: boolean;
}

/** Rough seconds per input type, for the estimate above. */
export const INPUT_SECONDS: Readonly<Record<InputType, number>> = {
  select: 5, date: 8, text: 8, chips: 12, pair: 15, "date-list": 20, longtext: 25,
};
