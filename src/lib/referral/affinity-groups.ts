import { normalizeText } from "@/lib/affinity/normalize";

/**
 * Named affinity organisations: the student chapters and professional
 * societies that employee resource groups recruit through. The report ranks
 * an ERG advocate second because the group exists to bring people like the
 * student in, so the incentive to refer is built in.
 *
 * This is a list of ORGANISATIONS, matched only when the student and the
 * person have both named the same one. Nothing here is used to guess who
 * anyone is: not from a name, a photo, a school or a hometown.
 */
const GROUPS: Record<string, readonly string[]> = {
  nsbe: ["national society of black engineers", "nsbe"],
  shpe: ["society of hispanic professional engineers", "shpe"],
  swe: ["society of women engineers", "swe"],
  sase: ["society of asian scientists and engineers", "sase"],
  ostem: ["out in science technology engineering and mathematics", "ostem"],
  aises: ["american indian science and engineering society", "aises"],
  alpfa: ["association of latino professionals for america", "alpfa"],
  naba: ["national association of black accountants", "naba"],
  ascend: ["ascend", "ascend pan asian leaders"],
  mlt: ["management leadership for tomorrow", "mlt"],
  sponsors_for_educational_opportunity: ["sponsors for educational opportunity", "seo", "seo scholars"],
  out_for_undergrad: ["out for undergrad", "o4u"],
  reaching_out_mba: ["reaching out mba", "romba"],
  student_veterans: ["student veterans of america", "sva", "student veterans association"],
  first_gen: ["first generation students", "first gen scholars", "first-gen scholars", "first generation scholars", "firstgen"],
  women_in_business: ["women in business", "wib"],
  women_in_tech: ["women in technology", "women in tech", "wit"],
  black_business: ["black business student association", "bbsa", "national black mba association", "nbmbaa"],
  forte: ["forte foundation", "forte fellows"],
};

const ALIAS = new Map<string, string>();
for (const [key, names] of Object.entries(GROUPS)) {
  for (const n of names) ALIAS.set(normalizeText(n), key);
}

/** "SWE at Virginia Tech" -> "swe"; anything not on the list -> null. */
export function affinityGroup(raw: string): { key: string; display: string } | null {
  const text = normalizeText(raw);
  if (!text) return null;
  // "SWE at Virginia Tech", "NSBE chapter": the group before the chapter words.
  const bare = text.replace(/ at .*$/, "").replace(/ (chapter|club|student chapter|professional chapter)$/, "");
  const direct = ALIAS.get(text) ?? ALIAS.get(bare);
  if (direct) return { key: direct, display: raw.trim() };
  // A full name inside a longer one: "Deloitte Society of Women Engineers network".
  // Only full names — a bare acronym like "seo" or "wit" inside a sentence is
  // far more likely to mean something else.
  for (const [alias, key] of ALIAS) {
    if (alias.includes(" ") && new RegExp(`(^| )${alias}( |$)`).test(text)) return { key, display: raw.trim() };
  }
  return null;
}
