import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { windowLabel } from "@/components/opening-row";
import { PersonCard } from "@/components/person-card";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { rankPeople } from "@/lib/affinity/score";
import { scorePersonByHomophily } from "@/lib/homophily";
import { companyInfo, sameCompany } from "@/lib/companies";
import { getPeopleProvider } from "@/lib/people";
import { getPositionsProvider, positionGaps, rankPositions } from "@/lib/positions";
import { rankByReferral } from "@/lib/referral";
import { getSession } from "@/lib/session";
import { AskAgent } from "./ask-agent";

export const dynamic = "force-dynamic";
/** The model calls behind this page can take longer than a default function budget. */
export const maxDuration = 60;

/**
 * One opening. The page a student lands on after choosing where they want to
 * be: what the employer asks for and where the student stands on each item,
 * the people they already have a path to there, and — on request — the agent's
 * plan and resume. The apply link is the employer's own; we never submit.
 */
export default async function OpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/jobs/${id}`);

  const provider = getPositionsProvider();
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 8000 });
  const position = positions.find((p) => p.id === id);
  if (!position) notFound();

  const scorable = { profile: student.profile, facts: student.facts };
  const fit = rankPositions(scorable, [position], { allVerticals: true })[0].fit;
  const gaps = positionGaps(scorable, position);
  const gapByReq = new Map(gaps.map((g) => [g.requirement.toLowerCase(), g]));
  const status = (req: string) => gapByReq.get(req.toLowerCase())?.status ?? "have";

  const info = companyInfo(position.company);
  const people = await getPeopleProvider()
    .getPeople({ companies: [position.company], limit: 2000 })
    .then((all) => all.filter((p) => sameCompany(p.currentCompany, position.company)))
    .catch(() => []);
  const ladder = new Map(rankPeople(scorable, people).results.map((r) => [r.personId, r]));
  const byId = new Map(people.map((p) => [p.id, p]));
  // The three most likely to refer the student into this opening.
  const top = rankByReferral(scorable, people).slice(0, 3);

  const missing = gaps.filter((g) => g.status === "missing").length;

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="openings" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label" href={`/dashboard/${info.slug}`}>&larr; {info.name}</Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-start justify-between gap-[var(--space-16)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <CompanyLogo name={position.company} size={56} />
              <div>
                <h1 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>{position.title}</h1>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-12) 0 0" }}>
                  {position.company}{position.location && <> &middot; {position.location}</>}
                  {position.category && <> &middot; {position.category.replace(/\s*\(\d[\d,]* roles\)\s*$/, "")}</>}
                </p>
                <p className="mono-micro" style={{ color: fit.datesKnown || fit.justPosted ? "var(--alert)" : "var(--ink-faint)", margin: "var(--space-8) 0 0" }}>
                  <span className={`tb-led ${fit.justPosted || fit.windowStatus === "open" ? "tb-led--live" : "tb-led--alert"}`} aria-hidden /> {windowLabel(fit)}
                  {fit.datesKnown && <> &middot; {position.opensOn} &rarr; {position.closesOn}</>}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-[var(--space-12)]">
              <span className="mono-label" style={{ border: "var(--border-2) solid var(--signal)", color: "var(--signal)", padding: "var(--space-4) var(--space-10)", whiteSpace: "nowrap" }}>
                Fit <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{Math.round(fit.score)}</span>
              </span>
              <div className="flex flex-wrap justify-end gap-[var(--space-8)]">
                <Link className="tb-btn tb-btn--sm tb-btn--solid mono-label" href={`/jobs/${position.id}/resume`}>Tailor my resume &#8599;</Link>
                {position.url && (
                  <a className="tb-btn tb-btn--sm mono-label" href={position.url} target="_blank" rel="noreferrer">The posting &#8599;</a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid gap-[var(--space-32)] lg:grid-cols-[1.35fr_1fr]">
          <div className="grid gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; What they&rsquo;re looking for</p>
              <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
                {position.requirements.map((r) => {
                  const st = r.kind === "skill" || r.kind === "certification" ? status(r.requirement) : "unknown";
                  const mark = st === "have" ? "●" : st === "in_progress" ? "◐" : st === "missing" ? "○" : "·";
                  const color = st === "have" ? "var(--signal)" : st === "in_progress" ? "var(--signal)" : st === "missing" ? "var(--alert)" : "var(--ink-faint)";
                  const label = st === "have" ? "you have it" : st === "in_progress" ? "in progress" : st === "missing" ? "not on your profile" : "we can't check this";
                  return (
                    <li key={`${r.kind}-${r.requirement}`} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                      <span className="body-sm" style={{ margin: 0 }}>
                        <span style={{ color, marginRight: 8 }} aria-hidden>{mark}</span>{r.requirement}
                        <span className="mono-micro" style={{ marginLeft: 8, color: r.required ? "var(--ink-subtle)" : "var(--ink-faint)" }}>{r.required ? "required" : "preferred"}</span>
                      </span>
                      <span className="mono-micro" style={{ color, whiteSpace: "nowrap" }}>{label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                {position.requirementsTypical
                  ? <>&gt; Typical for {position.category?.replace(/\s*\(\d[\d,]* roles\)\s*$/, "") ?? "this kind of"} internships &mdash; the directory has no posting text, so read the posting itself before you count on any of these.</>
                  : <>&gt; From the posting.</>}
              </p>
              {position.description && <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>{position.description}</p>}
            </div>

            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Where you stand</p>
              <ul className="body-sm" style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)", color: "var(--ink-muted)" }}>
                {fit.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>

            <AskAgent positionId={position.id} provider={provider.name} gapsCount={missing} />
          </div>

          <aside className="grid gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Most likely to refer you at {info.name}</p>
              {top.length === 0 ? (
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
                  Nobody at {info.name} in the pool yet. The strongest path to a posting is still a person — check the company page for alumni nearby.
                </p>
              ) : (
                <div className="grid gap-[var(--space-12)]" style={{ marginTop: "var(--space-12)" }}>
                  {top.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={ladder.get(r.personId)!} referral={r} homophily={scorePersonByHomophily(student, byId.get(r.personId)!)} />)}
                </div>
              )}
              <Link className="tb-link mono-label" href={`/dashboard/${info.slug}`} style={{ display: "inline-block", marginTop: "var(--space-16)" }}>
                Everyone at {info.name} &#8599;
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Fit", value: `${Math.round(fit.score)} / 100` },
          { label: "Missing", value: String(missing) },
          { label: "People here", value: String(people.length) },
          { label: "Requirements", value: position.requirementsTypical ? "typical for category" : "from posting" },
          { label: "Source", value: provider.name },
        ]}
      />
    </div>
  );
}
