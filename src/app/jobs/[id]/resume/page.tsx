import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { getSession } from "@/lib/session";
import { analyzeJob, resumeFileName, tailorForPosting, tailorMode } from "@/lib/tailor";
import { findPosition } from "@/lib/tailor/lookup";
import { answersOf, liveMetrics } from "@/lib/tailor/refs";
import { SKILL_NAMES } from "@/lib/tailor/skills";
import { Workspace } from "./workspace";

export const dynamic = "force-dynamic";
/** A model rewrite can take longer than a default function budget. */
export const maxDuration = 60;

const MODE_LABEL = { rules: "rules (no model)", anthropic: "Claude", databricks: "Databricks" } as const;
const SEVERITY_TONE = { critical: "var(--alert)", major: "var(--alert)", minor: "var(--ink-faint)" } as const;
const STATUS = {
  have: { mark: "●", color: "var(--signal)", label: "you have it" },
  in_progress: { mark: "◐", color: "var(--signal)", label: "in progress" },
  missing: { mark: "○", color: "var(--alert)", label: "not on your profile" },
  unchecked: { mark: "·", color: "var(--ink-faint)", label: "we can't check this" },
} as const;

/**
 * The resume tailor for one opening. The analysis on the right is computed on
 * every load; the resume is tailored on the spot in rules mode (instant) and
 * on request when a model is attached (seconds, and it costs something).
 */
export default async function TailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/jobs/${id}/resume`);

  const { position, provider } = await findPosition(student, id);
  if (!position) notFound();

  const mode = tailorMode();
  const analysis = analyzeJob({ profile: student.profile, facts: student.facts }, position);
  const email = demo ? null : student.email;
  const outcome = mode === "rules" ? await tailorForPosting({ profile: student.profile, facts: student.facts, position, email, mode }) : null;
  const answers = answersOf(liveMetrics(student.profile, student.facts.metrics));
  const fileName = resumeFileName(student.profile.full_name ?? "Resume", position.title, position.company);
  const kw = analysis.keywords;

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="resume" signedIn cta={null} email={email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label" href={`/jobs/${position.id}`}>&larr; The opening</Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-center gap-[var(--space-16)]">
            <CompanyLogo name={position.company} size={56} />
            <div>
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Resume tailor</p>
              <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-8) 0 0" }}>{position.title}</h1>
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-8) 0 0" }}>
                {position.company}{position.location && <> &middot; {position.location}</>}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid gap-[var(--space-32)] lg:grid-cols-[1.35fr_1fr]">
          <Workspace
            positionId={position.id}
            initial={{ outcome, answers, error: null }}
            via={MODE_LABEL[mode]}
            name={student.profile.full_name}
            fileName={fileName}
          />

          <aside className="grid gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <div className="flex items-baseline justify-between gap-[var(--space-12)]">
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; The posting, analyzed</p>
                {analysis.matchScore != null && (
                  <span className="mono-label" style={{ border: "var(--border-2) solid var(--signal)", color: "var(--signal)", padding: "var(--space-4) var(--space-10)", whiteSpace: "nowrap" }}>
                    Match <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{analysis.matchScore}%</span>
                  </span>
                )}
              </div>
              <p className="body-sm" style={{ margin: "var(--space-12) 0 0" }}>{analysis.verdict}</p>
              <p className="mono-micro" style={{ margin: "var(--space-4) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>
                Required counts 70%, preferred 30%; in progress counts half.
              </p>

              <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
                {analysis.requirements.map((r) => {
                  const s = STATUS[r.status];
                  return (
                    <li key={`${r.kind}-${r.requirement}`} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                      <span className="body-sm">
                        <span style={{ color: s.color, marginRight: 8 }} aria-hidden>{s.mark}</span>{r.requirement}
                        <span className="mono-micro" style={{ marginLeft: 8, color: r.required ? "var(--ink-subtle)" : "var(--ink-faint)" }}>{r.required ? "required" : "preferred"}</span>
                      </span>
                      <span className="mono-micro" style={{ color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
                    </li>
                  );
                })}
              </ul>

              {analysis.gaps.length > 0 && (
                <div className="tb-rule" style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-12)" }}>
                  <p className="mono-label" style={{ margin: 0, color: "var(--ink-subtle)" }}>Gaps</p>
                  <ul style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
                    {analysis.gaps.map((g) => (
                      <li key={g.requirement} className="body-sm">
                        <span className="mono-micro" style={{ color: SEVERITY_TONE[g.severity], marginRight: 8 }}>{g.severity}</span>
                        {g.requirement} <span style={{ color: "var(--ink-faint)" }}>&mdash; {g.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(kw.hard.length + kw.soft.length + kw.domain.length) > 0 && (
                <div className="tb-rule" style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-12)" }}>
                  <p className="mono-label" style={{ margin: 0, color: "var(--ink-subtle)" }}>Keywords</p>
                  {([["Hard skills", kw.hard], ["Soft skills", kw.soft], ["Domain", kw.domain]] as const).filter(([, list]) => list.length).map(([label, list]) => (
                    <p key={label} className="mono-micro" style={{ margin: "var(--space-8) 0 0", textTransform: "none", color: "var(--ink-muted)" }}>
                      <span style={{ color: "var(--ink-faint)" }}>{label}: </span>{list.join(" · ")}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; How it&rsquo;s tailored</p>
              <ol className="body-sm" style={{ margin: "var(--space-12) 0 0", paddingLeft: "1.2em", color: "var(--ink-muted)", display: "grid", gap: "var(--space-4)" }}>
                <li><b>Job description analyzer</b>: requirements, keywords, match score and gaps.</li>
                <li><b>Resume tailor</b>: summary for this role, most relevant skills and experience first.</li>
                <li><b>Bullet writer</b>: action verbs, and a number in every bullet, but only numbers you give.</li>
                <li><b>Formatter</b>: one page, one column, standard headers, a text PDF an ATS can read.</li>
              </ol>
              <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>
                {mode === "rules"
                  ? "This demo has no model attached, so the tailor applies the guides' mechanical rules: it reorders, fixes passive openers and asks for numbers. With a model it also rewrites wording, under the same checks."
                  : "The model reads all four guides, then rules that override them wherever they would invent something. Every employer, title, date, skill and number it writes is checked against your profile."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Match", value: analysis.matchScore == null ? "—" : `${analysis.matchScore}%` },
          { label: "Gaps", value: String(analysis.gaps.length) },
          { label: "Guides", value: String(SKILL_NAMES.length) },
          { label: "Tailor", value: MODE_LABEL[mode] },
          { label: "Source", value: provider },
        ]}
      />
    </div>
  );
}
