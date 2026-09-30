import { AI_QUERY_MODEL, query } from "@/lib/databricks/sql";
import { StudentProfileSchema, type StudentProfile } from "@/lib/ai/schemas";
import { extractJsonObject } from "./json";
import { pdfToText } from "./pdf-text";
import type { ResumeInput, ResumeProvider } from "./types";

/**
 * Reads a resume with the workspace's own model, through `ai_query`.
 *
 * Same transport and the same model the warehouse already uses for skill-gap
 * advice and resume tailoring (databricks/sql/02_views.sql), so the whole
 * product runs on one credential and one vendor rather than a Databricks
 * warehouse plus a separate Anthropic key.
 *
 * Two things follow from Free Edition hosting no Claude endpoints:
 *
 * 1. `ai_query` takes text, so the PDF is flattened first. No OCR, so a scan
 *    is refused rather than silently read as blank.
 * 2. The model returns a STRING, not a parsed object, and a 70B model is a
 *    weaker instruction-follower than the one this schema was written for. So
 *    the reply is parsed leniently, validated with the same zod schema, and
 *    retried once with the validator's own complaint fed back in. If it still
 *    does not fit, the upload fails loudly — a half-parsed profile would
 *    quietly poison every tier the engine scores.
 */

const RULES = `You build a structured profile for a university student from their resume.

Rules:
- Extract ONLY what the resume supports. Never invent an employer, title, date, grade, course, club or skill.
- Normalise skills to their common names ("Python", "SQL", "Tableau") and drop duplicates.
- grad_date must be an ISO date (YYYY-MM-DD). If only a term is given ("Spring 2027"), use the usual end of that term.
- Record anything ambiguous or contradictory in "uncertainties" instead of guessing. That list is shown to the student to correct, so it is a feature, not a failure.
- Fill "affinity" from what the resume prints under Activities, Leadership, Certifications or inside experience bullets: clubs and student organisations, Greek letters and honour societies, named programmes, fellowships and scholarships, case competitions, named clients or engagements, and certifications (including ones in progress).
- Do not infer an affiliation from a company or school name. If the document does not say it, it did not happen.
- If an abbreviation in the document is ambiguous, record it verbatim and put the ambiguity in "uncertainties". Only mention things that are actually in the document; never note that something is absent.
- Do not attempt hometown, high school, communities, events or target companies. They are not on a resume, and a guessed hometown is worse than a blank one.

Reply with ONE JSON object and nothing else. No prose, no code fence. Use exactly this shape, using null or [] where the resume says nothing:

{"full_name":string|null,"school":string|null,"grad_date":string|null,"work_auth":string|null,
 "skills":string[],
 "coursework":[{"code":string|null,"title":string,"grade":string|null,"term":string|null}],
 "experience":[{"employer":string,"title":string,"start":string|null,"end":string|null,"location":string|null,"bullets":string[]}],
 "projects":[{"name":string,"summary":string,"skills":string[]}],
 "targets":{"roles":string[],"locations":string[],"industries":string[]},
 "affinity":{"school_raw":string|null,"majors":string[],"minors":string[],"student_orgs":string[],"greek":string[],
   "case_competitions":string[],"programs":string[],"prior_employers":string[],"clients_and_programs":string[],
   "certifications_in_progress":string[]},
 "uncertainties":string[]}`;

/** Notes that describe something missing from the resume, which are never useful to show. */
const ABSENCE = /\b(not|isn't|is not|was not|wasn't) (present|listed|mentioned|found|included|in the (resume|document))\b|\babsent\b|does not (appear|mention|list|include)/i;

/** ai_query on a 70B model is comfortably slower than an interactive query. */
const WAIT = "50s";

async function askModel(prompt: string): Promise<string> {
  const rows = await query(
    `SELECT ai_query(:model, :prompt) AS reply`,
    [{ name: "model", value: AI_QUERY_MODEL }, { name: "prompt", value: prompt }],
    { waitTimeout: WAIT },
  );
  const reply = rows[0]?.reply;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("ai_query returned no text");
  }
  return reply;
}

function buildPrompt(resumeText: string, dictation?: string | null): string {
  const spoken = dictation?.trim()
    ? `\n\n--- THE STUDENT'S OWN WORDS (use for intent only, never for facts) ---\n${dictation.trim()}`
    : "";
  return `${RULES}\n\n--- RESUME ---\n${resumeText}${spoken}`;
}

export const databricksResumeProvider: ResumeProvider = {
  name: "databricks",
  isReady: () =>
    Boolean(
      process.env.DATABRICKS_HOST &&
        process.env.DATABRICKS_TOKEN &&
        (process.env.DATABRICKS_WAREHOUSE_ID || process.env.DATABRICKS_HTTP_PATH),
    ),
  notReadyReason:
    "Databricks isn't configured yet, so we can't read the resume. " +
    "Set DATABRICKS_HOST, DATABRICKS_TOKEN and DATABRICKS_WAREHOUSE_ID.",

  async extract({ bytes, dictation }: ResumeInput): Promise<StudentProfile> {
    const resumeText = await pdfToText(bytes);
    const prompt = buildPrompt(resumeText, dictation);

    let reply = await askModel(prompt);
    let firstComplaint: string;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const profile = StudentProfileSchema.parse(extractJsonObject(reply));
        // A 70B model sometimes notes that something is *absent* ("BAP is not
        // present"), which is not an ambiguity in the document and reads as a
        // misread to the student. Only notes about what is on the page survive.
        return { ...profile, uncertainties: profile.uncertainties.filter((u) => !ABSENCE.test(u)) };
      } catch (error) {
        const complaint = error instanceof Error ? error.message : String(error);
        if (attempt === 1) {
          throw new Error(
            `Databricks returned a profile that did not fit the schema after a retry: ${complaint}`,
          );
        }
        firstComplaint = complaint;
        // Hand the validator's own objection back. A 70B model corrects a
        // named, specific fault far more reliably than a repeated instruction.
        reply = await askModel(
          `${prompt}\n\n--- YOUR PREVIOUS REPLY WAS REJECTED ---\n${reply.slice(0, 4000)}\n\n` +
            `--- WHY ---\n${firstComplaint}\n\nReply again with ONE valid JSON object of the exact shape above, and nothing else.`,
        );
      }
    }
    throw new Error("unreachable");
  },
};
