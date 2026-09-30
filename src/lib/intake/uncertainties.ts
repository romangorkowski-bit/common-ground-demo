/**
 * Routes the extractor's own `uncertainties` to the questions that resolve
 * them.
 *
 * Deliberately regexes and not an LLM: it is twenty lines, it is testable, and
 * an API round-trip here would add a second of latency to rendering a screen.
 * A flagged field jumps the queue and shows the extractor's exact sentence
 * inline — "we read 'BAP' and couldn't tell if that's Beta Alpha Psi" is a far
 * better prompt than asking the question cold.
 */
export const UNCERTAINTY_HINTS: ReadonlyArray<{ re: RegExp; fields: readonly string[] }> = [
  // Not "campus": "an on-campus job" is about an employer, not a school.
  { re: /school|universit|college|alma mater/i,                fields: ["school_canonical"] },
  { re: /graduat|class of|expected|degree date/i,              fields: ["school_grad_year"] },
  { re: /major|degree|concentration|minor/i,                   fields: ["majors"] },
  { re: /club|societ|chapter|fraternit|sororit|greek|acronym|abbreviat|activit|organi[sz]ation/i,
                                                               fields: ["student_orgs", "greek"] },
  { re: /case competition|hackathon/i,                         fields: ["case_competitions"] },
  { re: /fellowship|scholarship|honou?rs|insight program/i,    fields: ["programs"] },
  { re: /employer|company|intern|position|role|job/i,          fields: ["prior_employers"] },
  { re: /client|engagement|account|agency/i,                   fields: ["clients_and_programs"] },
  { re: /certif|licen[cs]/i,                                   fields: ["certifications_in_progress"] },
  { re: /project|repo|paper|publication/i,                     fields: ["projects_public"] },
];

export interface RoutedUncertainties {
  /** fieldId -> the extractor's own sentences about it. */
  byField: Map<string, string[]>;
  /** Anything that matched no hint. Shown as one catch-all box. */
  unrouted: string[];
}

export function routeUncertainties(uncertainties: readonly string[]): RoutedUncertainties {
  const byField = new Map<string, string[]>();
  const unrouted: string[] = [];

  for (const note of uncertainties) {
    const matched = UNCERTAINTY_HINTS.filter((h) => h.re.test(note));
    if (!matched.length) {
      unrouted.push(note);
      continue;
    }
    for (const hint of matched) {
      for (const fieldId of hint.fields) {
        const list = byField.get(fieldId) ?? [];
        if (!list.includes(note)) list.push(note);
        byField.set(fieldId, list);
      }
    }
  }
  return { byField, unrouted };
}
