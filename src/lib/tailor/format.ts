import type { TailoredResume } from "@/lib/ai/schemas";
import { monthYear } from "./dates";
import { hasNumber, hasWeakOpener } from "./rules";

/**
 * The resume-formatter guide's checklist plus the bullet-writer guide's
 * strength checklist, run on the finished resume. "warn" is something the
 * student may reasonably leave; "fail" is something they should fix first.
 */
export interface FormatCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

const MAX_BULLET_CHARS = 200; // about two lines at 10.5pt across a 0.6" margin page

export function formatCheck(resume: TailoredResume, opts: { pages: number; name: string | null; contact: string[] }): FormatCheck[] {
  const checks: FormatCheck[] = [];
  const add = (id: string, label: string, status: FormatCheck["status"], detail: string) => checks.push({ id, label, status, detail });
  const bullets = [...resume.experience.flatMap((e) => e.bullets), ...resume.projects.flatMap((p) => p.bullets)];

  add("one-page", "One page", opts.pages === 1 ? "pass" : "fail",
    opts.pages === 1 ? "Fits on one page, the entry-level length." : `Runs to ${opts.pages} pages. Entry-level resumes are one; cut the least relevant bullets.`);

  add("header", "Name and contact at the top", !opts.name ? "fail" : opts.contact.length ? "pass" : "warn",
    !opts.name ? "No name on the profile." : opts.contact.length ? "In the body, not a page header, so an ATS reads it."
      : "Only your name. Add your email, phone and LinkedIn to the PDF yourself; the app does not keep them.");

  const [recent, ...older] = resume.experience;
  const tooMany = resume.experience.filter((e) => e.bullets.length > 6);
  add("bullet-count", "3 to 6 bullets per recent role",
    tooMany.length ? "fail" : recent && recent.bullets.length < 3 ? "warn" : "pass",
    tooMany.length ? `${tooMany.map((e) => e.employer).join(", ")} ${tooMany.length === 1 ? "has" : "have"} more than 6. Keep the strongest.`
      : recent && recent.bullets.length < 3 ? `${recent.employer} has ${recent.bullets.length}. If you did more there, add it to your resume and upload it again.`
        : older.length ? "Recent role has room; older roles stay shorter." : "Within range.");

  const long = bullets.filter((b) => b.length > MAX_BULLET_CHARS);
  add("bullet-length", "Bullets are one or two lines", long.length ? "fail" : "pass",
    long.length ? `${long.length} bullet${long.length === 1 ? " runs" : "s run"} past two lines.` : "Every bullet fits in two lines.");

  const weak = bullets.filter(hasWeakOpener);
  add("action-verbs", "Bullets open with an action verb", weak.length ? "fail" : "pass",
    weak.length ? `Still passive: "${weak[0].slice(0, 60)}".` : "No \"responsible for\" or \"helped with\".");

  const bare = bullets.filter((b) => !hasNumber(b));
  add("metrics", "Every bullet has a number", bare.length ? "warn" : "pass",
    bare.length ? `${bare.length} of ${bullets.length} ${bare.length === 1 ? "has" : "have"} none. Answer the questions above; nothing is estimated for you.`
      : "Each one is quantified, from your own numbers.");

  const unreadable = resume.experience.flatMap((e) => [e.start, e.end].filter((d): d is string => Boolean(d) && !monthYear(d)).map((d) => `${e.employer}: ${d}`));
  add("dates", "Dates read Mon YYYY", unreadable.length ? "warn" : "pass",
    unreadable.length ? `Could not read ${unreadable.join(", ")}; printed as written.` : "Consistent throughout.");

  add("ats", "ATS-safe layout", "pass", "Single column, Helvetica, standard section headers, text-based PDF. No tables, columns or images.");

  return checks;
}
