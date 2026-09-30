import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { StudentProfileSchema, type StudentProfile } from "./schemas";

export interface SourceDocument {
  kind: "resume" | "transcript" | "linkedin";
  /** Raw PDF bytes, base64-encoded. */
  base64: string;
}

const SYSTEM = `You build a structured profile for a university student from their own documents.

Rules:
- Extract only what the documents and the student's own words support. Never invent an employer, title, date, grade, course or skill.
- Reason across documents together: a transcript course implies a skill the resume may not name, and the resume dates the coursework.
- Prefer the student's spoken answers for intent (what they want) and the documents for fact (what they have done).
- Normalise skills to their common names ("Python", "SQL", "Tableau") and drop duplicates.
- grad_date must be an ISO date. If only a term is given ("Spring 2027"), use the usual end of that term.
- Record anything ambiguous or contradictory in "uncertainties" instead of guessing. That list is shown to the student to correct, so it is a feature, not a failure.

Also fill "affinity": clubs and student organisations, Greek letters and honour societies, named programmes, fellowships and scholarships, case competitions, named clients or engagements, and certifications (including ones in progress). These decide who we introduce the student to, so a club you skipped costs them a real connection.
- Do not infer an affiliation from a company or school name. If the document does not say it, it did not happen.
- If an abbreviation in the document is ambiguous, record it verbatim and put the ambiguity in "uncertainties" — the student is shown that note next to the question that resolves it.
- Do not attempt hometown, high school, communities, events or target companies. They are not on a resume, and a guessed hometown is worse than a blank one.`;

export async function extractProfile(input: {
  documents: SourceDocument[];
  dictation?: string | null;
}): Promise<StudentProfile> {
  const { documents, dictation } = input;
  if (documents.length === 0 && !dictation?.trim()) {
    throw new Error("extractProfile needs at least one document or some dictation");
  }

  const content: Anthropic.ContentBlockParam[] = [];
  for (const doc of documents) {
    content.push({ type: "text", text: `--- ${doc.kind.toUpperCase()} ---` });
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
    });
  }
  if (dictation?.trim()) {
    content.push({
      type: "text",
      text: `--- STUDENT'S OWN WORDS (dictated) ---\n${dictation.trim()}`,
    });
  }
  content.push({ type: "text", text: "Build the structured profile from the above." });

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(StudentProfileSchema) },
    messages: [{ role: "user", content }],
  });

  if (!response.parsed_output) {
    throw new Error(`Profile extraction returned no parsed output (${response.stop_reason})`);
  }
  return response.parsed_output;
}
