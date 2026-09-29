import type { AgentResult } from "@/lib/plan/agent";

const money = (n: number | null) => (n == null ? "—" : n === 0 ? "free" : `$${n.toLocaleString()}`);

/**
 * What the agent did, what to do, and the resume — in that order, because the
 * trace is the part that makes the other two believable.
 */
export function PlanResult({ result }: { result: AgentResult }) {
  const { plan, resume, fabrications, trace } = result;
  return (
    <div className="grid gap-[var(--space-24)]" style={{ marginTop: "var(--space-24)" }}>
      <section className="tb-panel">
        <p className="mono-label" style={{ margin: 0 }}>&gt; How to improve your chances</p>
        <p className="body-sm" style={{ margin: "var(--space-12) 0 0" }}>{plan.whyThisRole}</p>
        {plan.steps.length === 0 ? (
          <p className="body-sm" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-muted)" }}>Nothing on the posting is missing from your profile. Spend the time on the people who can get you in the room.</p>
        ) : (
          <ol style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-16)" }}>
            {plan.steps.map((s) => (
              <li key={`${s.order}-${s.requirement}`} className="tb-rule" style={{ paddingTop: "var(--space-12)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                  <p className="title" style={{ margin: 0, textTransform: "uppercase" }}>
                    <span style={{ color: "var(--ink-faint)" }}>{String(s.order).padStart(2, "0")}</span> {s.requirement}
                    <span className="mono-micro" style={{ marginLeft: 8, color: s.inProgress ? "var(--signal)" : s.required ? "var(--alert)" : "var(--ink-faint)" }}>{s.inProgress ? "in progress — finish it" : s.required ? "required" : "preferred"}</span>
                  </p>
                  <p className="mono-micro" style={{ margin: 0, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                    {money(s.cost_usd)}{s.weeks != null && <> &middot; {s.weeks} wk</>}
                  </p>
                </div>
                {s.provider && <p className="mono-micro" style={{ margin: "var(--space-4) 0 0", color: "var(--ink-subtle)", textTransform: "none" }}>{s.provider}</p>}
                <p className="body-sm" style={{ margin: "var(--space-8) 0 0", color: "var(--ink-muted)" }}>{s.action}</p>
                {s.url && <a className="tb-link mono-micro" href={s.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "var(--space-8)" }}>Start here &#8599;</a>}
              </li>
            ))}
          </ol>
        )}
        {plan.timeline && <p className="body-sm" style={{ margin: "var(--space-16) 0 0" }}><span className="mono-label" style={{ color: "var(--ink-subtle)" }}>Sequence &mdash; </span>{plan.timeline}</p>}
        <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-faint)" }}>
          Total {money(plan.totalCost)} &middot; about {plan.totalWeeks} weeks &middot; window opens {plan.opensOn}
        </p>
      </section>

      <section className="tb-panel">
        <p className="mono-label" style={{ margin: 0 }}>&gt; Your resume for this role</p>
        {!resume ? (
          <p className="body-sm" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-muted)" }}>
            {result.mode === "fallback" && result.model.startsWith("none")
              ? "In the full version a model rewrites your resume for this role, and every employer, title and date is checked against your profile. This demo runs without a model, so the plan above is computed and the rewrite is skipped."
              : "The rewrite did not come back this run. The plan above stands; try again for the resume."}
          </p>
        ) : (
          <>
            {fabrications.length > 0 && (
              <p className="body-sm" style={{ margin: "var(--space-12) 0 0", padding: "var(--space-12)", border: "var(--border-1) solid var(--rule-strong)", background: "var(--canvas-raised)" }}>
                <span className="mono-label" style={{ color: "var(--alert)" }}>Check these before sending &mdash; </span>
                the fabrication check flagged {fabrications.length}: {fabrications.map((f) => `${f.value} (${f.detail})`).join("; ")}
              </p>
            )}
            <p className="body-sm" style={{ margin: "var(--space-12) 0 0" }}>{resume.summary}</p>
            <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-subtle)", textTransform: "none" }}>Skills: {resume.skills.join(" · ")}</p>
            {resume.experience.map((e) => (
              <div key={`${e.employer}-${e.title}`} style={{ marginTop: "var(--space-16)" }}>
                <p className="title" style={{ margin: 0, textTransform: "uppercase" }}>{e.title} <span style={{ color: "var(--ink-faint)" }}>&middot; {e.employer}</span></p>
                <p className="mono-micro" style={{ margin: "2px 0 0", color: "var(--ink-faint)" }}>{[e.start, e.end].filter(Boolean).join(" – ")}</p>
                <ul className="body-sm" style={{ margin: "var(--space-8) 0 0", paddingLeft: "1.2em", color: "var(--ink-muted)" }}>
                  {e.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            ))}
            {resume.projects.map((p) => (
              <div key={p.name} style={{ marginTop: "var(--space-16)" }}>
                <p className="title" style={{ margin: 0, textTransform: "uppercase" }}>{p.name}</p>
                <ul className="body-sm" style={{ margin: "var(--space-8) 0 0", paddingLeft: "1.2em", color: "var(--ink-muted)" }}>
                  {p.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            ))}
            <div className="tb-rule" style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-12)" }}>
              <p className="mono-label" style={{ margin: 0, color: "var(--ink-subtle)" }}>What changed</p>
              <ul className="mono-micro" style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-4)", textTransform: "none" }}>
                {resume.changes.map((c, i) => <li key={i}><span style={{ color: "var(--ink)" }}>{c.change}</span> <span style={{ color: "var(--ink-faint)" }}>&mdash; {c.rationale}</span></li>)}
              </ul>
            </div>
            <p className="mono-micro" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>
              Every employer, title, date and project above was checked against your confirmed profile. Nothing here is sent anywhere; you do that.
            </p>
          </>
        )}
      </section>
          <details className="tb-panel">
        <summary className="mono-label" style={{ cursor: "pointer" }}>&gt; How this was worked out <span className="mono-micro" style={{ color: "var(--ink-faint)", marginLeft: 12 }}>{result.mode === "agent" ? "the model chose the tools" : "fixed order"} &middot; {result.model} &middot; {(result.durationMs / 1000).toFixed(1)}s</span>

        </summary>
        <ol style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
          {trace.map((t) => (
            <li key={t.step} className="mono-micro flex flex-wrap gap-[var(--space-12)]" style={{ textTransform: "none" }}>
              <span style={{ color: "var(--ink-faint)", minWidth: 18 }}>{String(t.step).padStart(2, "0")}</span>
              <span style={{ color: "var(--signal)" }}>{t.tool}{Object.keys(t.args).length ? `(${Object.values(t.args).map(String).join(", ")})` : "()"}</span>
              <span style={{ color: "var(--ink-muted)" }}>&rarr; {t.summary}</span>
              {t.ms > 0 && <span style={{ marginLeft: "auto", color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{t.ms} ms</span>}
            </li>
          ))}
        </ol>
        {result.note && <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>&gt; {result.note}</p>}
      </details>
    </div>
  );
}
