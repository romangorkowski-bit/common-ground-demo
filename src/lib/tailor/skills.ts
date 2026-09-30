import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The four resume guides the tailor follows, kept verbatim in ./skills so they
 * can be updated by replacing the file. Order is the order of the work:
 * read the posting, tailor to it, sharpen the bullets, lay out the page.
 */
export const SKILL_NAMES = [
  "job-description-analyzer",
  "resume-tailor",
  "resume-bullet-writer",
  "resume-formatter",
] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

const DIR = path.join(process.cwd(), "src", "lib", "tailor", "skills");

let guides: Record<SkillName, string> | null = null;

export function skillGuide(name: SkillName): string {
  guides ??= Object.fromEntries(
    SKILL_NAMES.map((n) => [n, readFileSync(path.join(DIR, `${n}.md`), "utf8")]),
  ) as Record<SkillName, string>;
  return guides[name];
}

/**
 * Where the guides and this product disagree, this wins. The bullet-writer
 * guide says to estimate a number when there is none ("if you think it was
 * 60%, say 50%"), and the tailor guide says to add missing keywords. Both are
 * reasonable advice to a person editing their own resume and both are
 * fabrication when a model does it for them.
 */
export const TRUTH_RULES = `RULES THAT OVERRIDE THE GUIDES ABOVE

Where any guide above conflicts with these rules, these rules win.

The confirmed profile is the ONLY source of truth. You may:
  - select which experience, projects and skills to include, and in what order
  - rewrite bullet wording to use the posting's vocabulary and a strong action verb
  - write a summary that frames existing facts for this role

You may NOT, under any circumstances:
  - add an employer, job title, date, school, credential, project or skill that is not in the profile
  - change any employment date, title or employer name
  - imply seniority, scope or results the profile does not state
  - state a proficiency the profile does not support
  - write ANY number (count, percentage, money, time saved) that is not already in the profile or in
    METRIC ANSWERS. Do not estimate, round up or use "~". This overrides the bullet-writer guide's
    "When You Don't Have Exact Numbers" section entirely.
  - list a keyword in "keywordsAdded" unless a profile skill, project skill or course title supports it

Instead of estimating a number, follow the bullet-writer guide's "Ask Clarifying Questions" step:
for each bullet that has no number and no METRIC ANSWER, add an entry to "metricPrompts" with the
bullet's ref (from BULLET REFS), its text, one short question a student can answer from memory
("About how many survey responses did you clean?"), and the unit the answer will be in.
Where a METRIC ANSWER exists for a bullet, use its value and unit in that bullet.

If the student lacks something the posting wants, leave it out. Do not soften the gap with vague
phrasing that implies they have it. A student signs their name to this document and will be asked
about every line of it in an interview.

Populate "changes" with one plain-language entry per meaningful edit, with the line before and after
(null for a pure reorder), so the student can see what you did before they send it.

The student is entry level: one page, 3-6 bullets for a recent role, fewer for older ones, each bullet
one or two lines.`;

/** The four guides, then the rules. Stable across calls, so it caches. */
export function tailorSystemPrompt(): string {
  const body = SKILL_NAMES.map((n) => `<guide name="${n}">\n${skillGuide(n).trim()}\n</guide>`).join("\n\n");
  return `You tailor a university student's resume to one job posting by following these four guides in order.\n\n${body}\n\n${TRUTH_RULES}`;
}
