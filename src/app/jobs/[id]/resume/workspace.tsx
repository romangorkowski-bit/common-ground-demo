"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { TailoredResumeView } from "@/components/tailored-resume-view";
import { ProgressBar } from "@/components/tb/progress-bar";
import { tailorAction, type TailorState } from "./actions";

const subscribe = (notify: () => void) => { const id = setInterval(notify, 500); return () => clearInterval(id); };
const tick = () => Math.floor(Date.now() / 500);

/** Stage labels follow the guides' order; the seconds are measured. */
function stageAt(elapsed: number): string {
  if (elapsed < 2) return "Reading the posting (job-description-analyzer)";
  if (elapsed < 10) return "Tailoring to it (resume-tailor)";
  if (elapsed < 20) return "Sharpening the bullets (resume-bullet-writer)";
  if (elapsed < 40) return "Laying out the page (resume-formatter)";
  return "Still working — the model takes its time";
}

function Progress({ via, typical }: { via: string; typical: number }) {
  const [startedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribe, tick, () => 0);
  const elapsed = now === 0 ? 0 : Math.max(0, Math.round((now * 500 - startedAt) / 1000));
  return (
    <div style={{ marginTop: "var(--space-16)" }} aria-live="polite">
      <ProgressBar elapsed={elapsed} typicalSeconds={typical} label="Tailoring your resume" />
      <div className="mono-micro flex flex-wrap items-center justify-between gap-[var(--space-12)]" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)" }}>
        <span style={{ textTransform: "uppercase" }}><span className="tb-led tb-led--live" aria-hidden /> {stageAt(elapsed)}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed}s &middot; via {via}</span>
      </div>
    </div>
  );
}

const MARK = { pass: "●", warn: "◐", fail: "○" } as const;
const TONE = { pass: "var(--signal)", warn: "var(--ink-subtle)", fail: "var(--alert)" } as const;

/**
 * The tailor's working surface: the resume, the questions that would put a
 * number in each bullet, and the format check with the download. The only
 * inputs are numbers the student types; everything else comes from the
 * confirmed profile.
 */
export function Workspace({ positionId, initial, via, name, fileName }: {
  positionId: string;
  initial: TailorState;
  via: string;
  name: string | null;
  fileName: string;
}) {
  const [state, action, pending] = useActionState<TailorState, FormData>(tailorAction, initial);
  const { outcome } = state;
  const typical = via.startsWith("rules") ? 1 : 25;

  const hidden = (intent: string) => (
    <>
      <input type="hidden" name="position" value={positionId} />
      <input type="hidden" name="intent" value={intent} />
    </>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-24)] content-start">
      <section className="tb-panel">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
          <div className="tb-copy">
            <p className="mono-label" style={{ margin: 0 }}>&gt; Your resume for this role</p>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
              Rewritten from your confirmed profile only. Nothing is invented, and every number comes from you.
            </p>
          </div>
          {!pending && (
            <form action={action}>
              {hidden("tailor")}
              <button type="submit" className={`tb-btn mono-label ${outcome ? "tb-btn--sm" : "tb-btn--solid"}`}>{outcome ? "Tailor again" : "Tailor my resume ↗"}</button>
            </form>
          )}
        </div>
        {pending && <Progress via={via} typical={typical} />}
        {state.error && !pending && (
          <p className="body-sm" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-muted)" }}>
            <span className="mono-label" style={{ color: "var(--alert)" }}>Could not finish &mdash; </span>{state.error}
          </p>
        )}
        {outcome?.note && <p className="mono-micro" style={{ margin: "var(--space-12) 0 0", color: "var(--ink-faint)", textTransform: "none" }}>&gt; {outcome.note}</p>}
        {outcome && <TailoredResumeView resume={outcome.resume} fabrications={outcome.fabrications} name={name} />}
      </section>

      {outcome && (outcome.resume.metricPrompts.length > 0 || state.answers.length > 0) && (
        <section className="tb-panel">
          <p className="mono-label" style={{ margin: 0 }}>&gt; Make your bullets stronger</p>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
            A bullet with a number reads as a result, not a duty. We won&rsquo;t guess yours: an honest rough count is fine, a made-up one is not.
          </p>
          <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-16)" }}>
            {outcome.resume.metricPrompts.map((m) => (
              <li key={m.bulletRef} className="tb-rule" style={{ paddingTop: "var(--space-12)" }}>
                <p className="body-sm" style={{ margin: 0, color: "var(--ink-muted)" }}>&ldquo;{m.bullet}&rdquo;</p>
                <p className="body-sm" style={{ margin: "var(--space-4) 0 0" }}>{m.question}</p>
                <form action={action} className="flex flex-wrap gap-[var(--space-8)]" style={{ marginTop: "var(--space-8)" }}>
                  {hidden("metric")}
                  <input type="hidden" name="ref" value={m.bulletRef} />
                  <input className="tb-field" name="value" required maxLength={40} inputMode="decimal" placeholder="e.g. 1,200" aria-label="The number" style={{ width: "9rem" }} disabled={pending} />
                  <input className="tb-field" name="unit" maxLength={40} defaultValue={m.unit} placeholder="unit" aria-label="What it counts" style={{ flex: 1, minWidth: "8rem" }} disabled={pending} />
                  <button type="submit" className="tb-btn tb-btn--sm mono-label" disabled={pending}>Add</button>
                </form>
              </li>
            ))}
          </ul>
          {state.answers.length > 0 && (
            <div className="tb-rule" style={{ marginTop: "var(--space-16)", paddingTop: "var(--space-12)" }}>
              <p className="mono-label" style={{ margin: 0, color: "var(--ink-subtle)" }}>Your numbers</p>
              <ul style={{ margin: "var(--space-8) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
                {state.answers.map((a) => (
                  <li key={a.ref} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                    <span className="body-sm"><span style={{ color: "var(--signal)" }}>{a.value} {a.unit}</span> <span style={{ color: "var(--ink-faint)" }}>&middot; {a.bullet}</span></span>
                    <form action={action}>
                      {hidden("forget")}
                      <input type="hidden" name="ref" value={a.ref} />
                      <button type="submit" className="tb-link mono-micro" disabled={pending}>Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {outcome && (
        <section className="tb-panel">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
            <p className="mono-label" style={{ margin: 0 }}>&gt; Format check</p>
            <form method="post" action={`/jobs/${positionId}/resume/pdf`}>
              <input type="hidden" name="resume" value={JSON.stringify(outcome.resume)} />
              <button type="submit" className="tb-btn tb-btn--solid mono-label" disabled={pending}>Download PDF &#8595;</button>
            </form>
          </div>
          <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
            {outcome.format.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                <span className="body-sm"><span style={{ color: TONE[c.status], marginRight: 8 }} aria-hidden>{MARK[c.status]}</span>{c.label}</span>
                <span className="mono-micro" style={{ color: TONE[c.status], textTransform: "none", maxWidth: "36rem", textAlign: "left" }}>{c.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mono-micro" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-faint)", textTransform: "none", overflowWrap: "anywhere" }}>
            {fileName} &middot; {outcome.pages} page{outcome.pages === 1 ? "" : "s"} &middot; via {outcome.model} &middot; {(outcome.durationMs / 1000).toFixed(1)}s. You send it; nothing is submitted for you.
          </p>
        </section>
      )}
    </div>
  );
}
