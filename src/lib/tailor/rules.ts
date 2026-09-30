import type { AffinityFacts, MetricAnswer, StudentProfile, TailoredResume } from "@/lib/ai/schemas";
import type { Position } from "@/lib/positions";
import type { JobAnalysis } from "./analysis";
import { mentions } from "./analysis";
import { monthYear } from "./dates";
import { bulletRefs, metricPhrase } from "./refs";

/**
 * The tailor with no model: the parts of the four guides that are mechanical.
 * It reorders (resume-tailor), fixes weak openers and asks for numbers
 * (resume-bullet-writer), and leaves layout to the PDF (resume-formatter).
 * It never writes a sentence the profile does not already contain, apart from
 * a templated summary built only from profile fields.
 */

/** Openers the bullet-writer guide calls out as passive, and what replaces them. */
const WEAK_OPENERS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(?:was\s+)?responsible\s+for\s+(\w+ing)\b\s*/i, (m) => `${pastTense(m[1])} `],
  [/^(?:was\s+)?responsible\s+for\s+/i, () => "Owned "],
  [/^(?:was\s+)?tasked\s+with\s+(\w+ing)\b\s*/i, (m) => `${pastTense(m[1])} `],
  [/^helped\s+(?:with|in)\s+/i, () => "Supported "],
  // "Helped build X" -> not "Built X": they helped, so the claim stays shared.
  [/^helped\s+(?:to\s+)?/i, () => "Collaborated to "],
  [/^assisted\s+(?:with|in)\s+/i, () => "Supported "],
  [/^assisted\s+/i, () => "Supported "],
  [/^worked\s+on\s+/i, () => "Collaborated on "],
  [/^participated\s+in\s+/i, () => "Contributed to "],
];

const IRREGULAR: Record<string, string> = {
  build: "Built", lead: "Led", run: "Ran", write: "Wrote", make: "Made", teach: "Taught",
  drive: "Drove", give: "Gave", oversee: "Oversaw", see: "Saw", hold: "Held", keep: "Kept", find: "Found",
};

/** "managing" -> "Managed", "planning" -> "Planned", "building" -> "Built". */
function pastTense(gerund: string): string {
  const stem = gerund.toLowerCase().replace(/ing$/, "");
  const irregular = IRREGULAR[stem] ?? IRREGULAR[`${stem}e`] ?? IRREGULAR[stem.replace(/(.)\1$/, "$1")];
  if (irregular) return irregular;
  // The "-ing" already dropped any silent e ("managing" -> "manag") and
  // doubled any consonant ("planning" -> "plann"), so "-ed" is right as is.
  const past = /[^aeiou]y$/.test(stem) ? `${stem.slice(0, -1)}ied` : `${stem}ed`;
  return past[0].toUpperCase() + past.slice(1);
}

export function strengthenOpener(bullet: string): string {
  const text = bullet.trim();
  for (const [re, replace] of WEAK_OPENERS) {
    const m = re.exec(text);
    if (m) {
      const rest = text.slice(m[0].length);
      return `${replace(m)}${rest}`.replace(/\s+/g, " ").trim();
    }
  }
  return text[0] ? text[0].toUpperCase() + text.slice(1) : text;
}

export const hasWeakOpener = (bullet: string) => WEAK_OPENERS.some(([re]) => re.test(bullet.trim()));
export const hasNumber = (s: string) => /\d/.test(s);

/** The bullet-writer guide's "ask clarifying questions" step, by what the bullet does. */
export function metricQuestion(bullet: string): { question: string; unit: string } {
  const verb = bullet.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (/^(cleaned|analy[sz]ed|processed|collected|surveyed|reviewed|audited|coded|entered|validated|researched)/.test(verb))
    return { question: "About how many records, responses or files did this cover?", unit: "records" };
  if (/^(built|created|developed|designed|launched|wrote|forecasts?|modell?ed|automated|programmed)/.test(verb))
    return { question: "How many people used it, or how often was it used?", unit: "users" };
  if (/^(led|managed|organi[sz]ed|coordinated|supervised|ran|mentored|trained|recruited)/.test(verb))
    return { question: "How many people, events or projects were involved?", unit: "people" };
  if (/^(reduced|improved|increased|streamlined|cut|saved|grew|raised)/.test(verb))
    return { question: "By how much? A percent, or hours a week, both work.", unit: "percent" };
  if (/^(presented|taught|spoke|pitched)/.test(verb))
    return { question: "To how many people?", unit: "people" };
  return { question: "What number shows the scale here: people, records, hours or dollars?", unit: "" };
}

export function rulesTailor(input: {
  profile: StudentProfile;
  facts: Pick<AffinityFacts, "certifications_in_progress">;
  position: Position;
  analysis: JobAnalysis;
  metrics: Record<string, MetricAnswer>;
}): TailoredResume {
  const { profile, position, analysis, metrics } = input;
  const terms = [...analysis.keywords.hard, ...analysis.keywords.soft, ...analysis.keywords.domain];
  const posting = [position.title, position.description ?? "", ...position.requirements.map((r) => r.requirement)].join(" \n ");
  const hits = (text: string) => terms.filter((t) => mentions(text, t)).length;
  const changes: TailoredResume["changes"] = [];
  const metricPrompts: TailoredResume["metricPrompts"] = [];
  const refs = new Map(bulletRefs(profile).map((b) => [b.ref, b]));

  /** One source line through the bullet-writer pass: opener, then the student's number. */
  const rework = (ref: string, source: string): string => {
    let line = strengthenOpener(source);
    if (line !== source.trim()) {
      changes.push({ change: "Replaced a passive opener with an action verb", rationale: "The bullet-writer guide: lead with what you did, not what you were responsible for.", before: source, after: line });
    }
    const answer = metrics[ref];
    if (answer && !hasNumber(line)) {
      const withNumber = `${line.replace(/[.;]\s*$/, "")} (${metricPhrase(answer)})`;
      changes.push({ change: "Added the number you gave", rationale: "Every bullet should carry one number; this one is yours.", before: line, after: withNumber });
      line = withNumber;
    } else if (!hasNumber(line) && refs.has(ref)) {
      metricPrompts.push({ bulletRef: ref, bullet: source, ...metricQuestion(line) });
    }
    return line;
  };

  // --- skills: only what the profile claims, the posting's asks first.
  const requested = new Set(position.requirements.map((r) => r.requirement.trim().toLowerCase()));
  const rank = (s: string) => (requested.has(s.toLowerCase()) ? 2 : mentions(posting, s) ? 1 : 0);
  const projectSkills = profile.projects.flatMap((p) => p.skills);
  const pool = [...new Map([...profile.skills, ...projectSkills].map((s) => [s.toLowerCase(), s])).values()];
  const skills = pool
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map((x) => x.s);
  const keywordsAdded = projectSkills
    .filter((s) => rank(s) > 0 && !profile.skills.some((k) => k.toLowerCase() === s.toLowerCase()))
    .filter((s, i, all) => all.indexOf(s) === i);
  if (skills.join() !== pool.join()) {
    changes.push({ change: "Reordered skills to lead with what the posting asks for", rationale: "The resume-tailor guide: your top skills should match their top requirements.", before: pool.join(", "), after: skills.join(", ") });
  }
  for (const k of keywordsAdded) {
    changes.push({ change: `Listed ${k} under skills`, rationale: "The posting asks for it and one of your projects uses it.", before: null, after: k });
  }

  // --- experience: most relevant role first, most relevant bullet first.
  const roles = profile.experience.map((e, i) => {
    const bullets = e.bullets
      .map((b, j) => ({ b, j, h: hits(b) }))
      .sort((a, b) => b.h - a.h || a.j - b.j);
    if (bullets.some((x, k) => x.j !== k)) {
      changes.push({ change: `Led with the most relevant bullet at ${e.employer}`, rationale: "The resume-tailor guide: each role's top bullet should answer the posting's key requirement.", before: null, after: null });
    }
    return {
      i,
      h: hits(`${e.title} ${e.bullets.join(" ")}`),
      role: {
        employer: e.employer, title: e.title, start: e.start, end: e.end,
        bullets: bullets.map((x) => rework(`exp:${i}:${x.j}`, x.b)),
      },
    };
  });
  const ordered = [...roles].sort((a, b) => b.h - a.h || a.i - b.i);
  if (ordered.some((r, k) => r.i !== k)) {
    changes.push({ change: `Moved ${ordered[0].role.title} at ${ordered[0].role.employer} to the top`, rationale: "The resume-tailor guide: the most relevant role goes first, whatever its date.", before: null, after: null });
  }

  const projects = profile.projects
    .map((p, i) => ({ p, i, h: hits(`${p.name} ${p.summary} ${p.skills.join(" ")}`) }))
    .sort((a, b) => b.h - a.h || a.i - b.i)
    .map(({ p, i }) => ({ name: p.name, bullets: p.summary ? [rework(`proj:${i}`, p.summary)] : [] }));

  // --- summary: the tailor guide's "mention the exact job title", from profile fields only.
  const role = position.title.replace(/\d+/g, "").replace(/\s{2,}/g, " ").replace(/[\s,–—-]+$/, "").trim();
  const majors = profile.affinity.majors.join(" and ");
  const grad = monthYear(profile.grad_date);
  const topSkills = skills.slice(0, 3);
  const latest = ordered[0]?.role;
  const summary = [
    `${role} candidate${majors || profile.school ? ":" : "."}${majors ? ` ${majors} student` : ""}${profile.school ? ` at ${profile.school}` : ""}${grad ? `, graduating ${grad}` : ""}${majors || profile.school ? "." : ""}`,
    topSkills.length ? `Works in ${topSkills.length > 1 ? `${topSkills.slice(0, -1).join(", ")} and ${topSkills.at(-1)}` : topSkills[0]}.` : "",
    latest ? `Most relevant experience: ${latest.title} at ${latest.employer}.` : "",
  ].filter(Boolean).join(" ");
  changes.unshift({ change: `Wrote the summary for ${role}`, rationale: "The resume-tailor guide: the summary names the job and leads with your closest match.", before: null, after: summary });

  // --- education: relevant coursework and certifications the formatter guide puts here.
  const courses = profile.coursework.filter((c) => hits(c.title) > 0 || profile.coursework.length <= 3).map((c) => c.title);
  const certs = [...new Set([...input.facts.certifications_in_progress, ...profile.affinity.certifications_in_progress])];
  const highlights = [
    courses.length ? `Relevant coursework: ${courses.join(", ")}` : "",
    ...certs.map((c) => `${c} (in progress)`),
  ].filter(Boolean);

  return {
    summary,
    skills,
    experience: ordered.map((r) => r.role),
    projects,
    education: { school: profile.school ?? "", credential: majors || null, grad_date: profile.grad_date, highlights },
    changes,
    keywordsAdded,
    metricPrompts,
  };
}
