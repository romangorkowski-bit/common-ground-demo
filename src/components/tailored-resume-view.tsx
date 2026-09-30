import type { Fabrication } from "@/lib/ai/fabrication-check";
import type { TailoredResume } from "@/lib/ai/schemas";
import { dateRange, monthYear } from "@/lib/tailor/dates";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginTop: "var(--space-16)" }}>
    <p className="mono-label" style={{ margin: 0, paddingBottom: "var(--space-4)", borderBottom: "var(--border-1) solid var(--rule-strong)" }}>{title}</p>
    {children}
  </div>
);

/**
 * A tailored resume as the student will send it, laid out in the same order
 * as the PDF, then what changed and why. Shared by the resume workspace and
 * the plan agent's result so the two never show the same resume differently.
 */
export function TailoredResumeView({ resume, fabrications, name }: { resume: TailoredResume; fabrications: Fabrication[]; name?: string | null }) {
  const bullets = (items: string[]) => (
    <ul className="body-sm" style={{ margin: "var(--space-4) 0 0", paddingLeft: "1.2em", color: "var(--ink-muted)" }}>
      {items.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );

  return (
    <>
      {fabrications.length > 0 && (
        <p className="body-sm" style={{ margin: "var(--space-12) 0 0", padding: "var(--space-12)", border: "var(--border-1) solid var(--alert)", background: "var(--canvas)" }}>
          <span className="mono-label" style={{ color: "var(--alert)" }}>Check these before sending &mdash; </span>
          the fabrication check flagged {fabrications.length}: {fabrications.map((f) => `${f.value} (${f.detail})`).join("; ")}
        </p>
      )}

      <div style={{ marginTop: "var(--space-16)", padding: "var(--space-24)", background: "var(--canvas)", border: "var(--border-1) solid var(--rule-strong)" }}>
        {name && <p className="title" style={{ margin: 0, fontSize: 20 }}>{name}</p>}
        {resume.summary && <Section title="Summary"><p className="body-sm" style={{ margin: "var(--space-8) 0 0" }}>{resume.summary}</p></Section>}
        {resume.skills.length > 0 && <Section title="Skills"><p className="body-sm" style={{ margin: "var(--space-8) 0 0" }}>{resume.skills.join(", ")}</p></Section>}
        {resume.experience.length > 0 && (
          <Section title="Experience">
            {resume.experience.map((e) => (
              <div key={`${e.employer}-${e.title}`} style={{ marginTop: "var(--space-12)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-8)]">
                  <p className="body-sm" style={{ margin: 0, fontWeight: 700 }}>{e.title}, {e.employer}</p>
                  <p className="mono-micro" style={{ margin: 0, color: "var(--ink-faint)" }}>{dateRange(e.start, e.end)}</p>
                </div>
                {bullets(e.bullets)}
              </div>
            ))}
          </Section>
        )}
        {resume.projects.length > 0 && (
          <Section title="Projects">
            {resume.projects.map((p) => (
              <div key={p.name} style={{ marginTop: "var(--space-12)" }}>
                <p className="body-sm" style={{ margin: 0, fontWeight: 700 }}>{p.name}</p>
                {bullets(p.bullets)}
              </div>
            ))}
          </Section>
        )}
        {resume.education.school && (
          <Section title="Education">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-8)]" style={{ marginTop: "var(--space-12)" }}>
              <p className="body-sm" style={{ margin: 0, fontWeight: 700 }}>{resume.education.school}</p>
              <p className="mono-micro" style={{ margin: 0, color: "var(--ink-faint)" }}>{monthYear(resume.education.grad_date) ?? ""}</p>
            </div>
            {resume.education.credential && <p className="body-sm" style={{ margin: "var(--space-4) 0 0" }}>{resume.education.credential}</p>}
            {resume.education.highlights.length > 0 && bullets(resume.education.highlights)}
          </Section>
        )}
      </div>

      {resume.changes.length > 0 && (
        <div className="tb-rule" style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-12)" }}>
          <p className="mono-label" style={{ margin: 0, color: "var(--ink-subtle)" }}>What changed</p>
          <ul style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-12)" }}>
            {resume.changes.map((c, i) => (
              <li key={i} className="body-sm">
                <span style={{ color: "var(--ink)" }}>{c.change}</span> <span style={{ color: "var(--ink-faint)" }}>&mdash; {c.rationale}</span>
                {(c.before || c.after) && c.before !== c.after && (
                  <div className="mono-micro" style={{ display: "grid", gap: 2, marginTop: "var(--space-4)", textTransform: "none" }}>
                    {c.before && <span style={{ color: "var(--ink-faint)", textDecoration: "line-through" }}>{c.before}</span>}
                    {c.after && <span style={{ color: "var(--signal)" }}>{c.after}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {resume.keywordsAdded.length > 0 && (
        <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-subtle)", textTransform: "none" }}>
          Keywords worked in, each backed by your profile: {resume.keywordsAdded.join(", ")}
        </p>
      )}
    </>
  );
}
