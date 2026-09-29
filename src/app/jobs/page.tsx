import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { OpeningRow } from "@/components/opening-row";
import companies from "@/../data/companies.seed.json";
import { getPositionsProvider, headlineGap, positionGaps, rankPositions, studentVerticals } from "@/lib/positions";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOf = (iso: string) => MONTH.format(new Date(iso + "T00:00:00Z"));

/**
 * The openings half of the product: what opens, when, scored for this
 * student, with what stands in the way. Grouped by the month the window
 * opens, soonest first, because "start early" is the whole positioning —
 * a sophomore who sees September's internship windows in September is
 * months ahead of one who looks in spring.
 */
export default async function JobsPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/jobs");

  const provider = getPositionsProvider();
  const scorable = { profile: student.profile, facts: student.facts };
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 8000 });
  const ranked = rankPositions(scorable, positions);
  const verticals = studentVerticals(scorable);
  // Everything at the companies the student chose, whatever the vertical —
  // the focus they set on the dashboard outranks our category guess.
  const targets = new Set(student.facts.target_companies.map((c) => c.trim().toLowerCase()));
  const atTargets = rankPositions(scorable, positions.filter((p) => targets.has(p.company.toLowerCase())), { allVerticals: true })
    .filter((r) => r.fit.windowStatus !== "closed")
    .sort((a, b) => Number(b.fit.justPosted) - Number(a.fit.justPosted) || b.fit.score - a.fit.score)
    .slice(0, 24);

  const gapsById = new Map(ranked.map((r) => [r.position.id, positionGaps(scorable, r.position)]));

  // The one AI line on the page: advice for the top opening's headline gap.
  // Mock mode shows a fixed example; the warehouse call is raced against a
  // deadline and simply absent if it loses.
  const top = ranked.find((r) => r.fit.windowStatus !== "closed") ?? ranked[0];
  const topGap = top ? headlineGap(gapsById.get(top.position.id) ?? []) : null;
  // No model call on the list: it held the page for up to 8 s. The opening
  // page's agent gives the real answer, with the trace.
  const advice: string | null = null;

  const open = ranked.filter((r) => r.fit.windowStatus !== "closed");
  const soon = open.filter((r) => r.fit.windowStatus === "open" || r.fit.windowStatus === "opens_soon");
  // A source with dates groups by the month the window opens; the directory,
  // which has none, groups by its own categories, just-posted first.
  const dated = open.filter((r) => r.fit.datesKnown).length * 2 > open.length;
  const PER_GROUP = 24;
  const months: { month: string; rows: typeof ranked; hidden: number }[] = [];
  const ordered = dated
    ? [...open].sort((a, b) => a.position.opensOn.localeCompare(b.position.opensOn) || b.fit.score - a.fit.score)
    : [...open].sort((a, b) => Number(b.fit.justPosted) - Number(a.fit.justPosted) || b.fit.score - a.fit.score);
  for (const r of ordered) {
    const month = dated ? monthOf(r.position.opensOn) : (r.position.category?.replace(/\s*\(\d[\d,]* roles\)\s*$/, "") ?? "Other");
    const group = months.find((m) => m.month === month) ?? (months.push({ month, rows: [], hidden: 0 }), months[months.length - 1]);
    if (group.rows.length < PER_GROUP) group.rows.push(r); else group.hidden += 1;
  }
  if (!dated) months.sort((a, b) => b.rows.length + b.hidden - (a.rows.length + a.hidden));
  const closed = dated ? ranked.filter((r) => r.fit.windowStatus === "closed") : [];
  const boards = companies as { ats: string }[];

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="openings" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Resume helper &middot; {provider.name === "databricks" ? "Summer 2027 Internships Directory" : "Sample postings"}</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            {dated ? <>{open.length} window{open.length === 1 ? "" : "s"},<br />soonest first.</> : <>Applications<br />picked for you.</>}
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            {!dated && open.length > 0
              ? `${open.length} real postings in the verticals you told us about, ${open.filter((r) => r.fit.justPosted).length} just posted. Open one: what they ask for, where you stand, who you know there, and the agent that plans the gaps and rewrites your resume for it.`
              : soon.length > 0
              ? `${soon.length} ${soon.length === 1 ? "is" : "are"} open or open inside 60 days. Check who you know there before you apply.`
              : verticals.length
                ? "Nothing opens in the next 60 days for what you told us. The ones below are further out."
                : "Tell us what you want to do and these sharpen."}
          </p>
        </div>
      </section>

      {top && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <p className="mono-label" style={{ color: "var(--signal)", margin: "0 0 var(--space-8)" }}>
              <span className="tb-led tb-led--live" aria-hidden /> Best fit right now
            </p>
            <OpeningRow ranked={top} gaps={gapsById.get(top.position.id) ?? []} advice={advice} />
            {topGap && (
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-8) 0 0", textTransform: "none" }}>
                Open it and ask the agent how to close the {topGap.requirement} gap.
              </p>
            )}
          </div>
        </section>
      )}

      {atTargets.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>At your companies</h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              {student.facts.target_companies.join(" · ")} &middot; every posting there, whatever the category
            </p>
            <div className="grid gap-[var(--space-16)] md:grid-cols-2">
              {atTargets.map((r) => (
                <OpeningRow key={r.position.id} ranked={r} gaps={gapsById.get(r.position.id) ?? positionGaps(scorable, r.position)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {months.map(({ month, rows, hidden }) => (
        <section key={month} className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>{month}</h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              {dated
                ? <>{rows.length} window{rows.length === 1 ? "" : "s"} open{rows.length === 1 ? "s" : ""} this month</>
                : <>{rows.length + hidden} posting{rows.length + hidden === 1 ? "" : "s"}{hidden > 0 && <> &middot; showing the {rows.length} that fit you best</>}</>}
            </p>
            <div className="tb-cards tb-cards--2">
              {rows.map((r) => (
                <OpeningRow key={r.position.id} ranked={r} gaps={gapsById.get(r.position.id) ?? []} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {closed.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>Missed</h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              Closed this cycle.
            </p>
            <div className="tb-cards tb-cards--2">
              {closed.map((r) => (
                <OpeningRow key={r.position.id} ranked={r} gaps={gapsById.get(r.position.id) ?? []} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap tb-panel">
          <p className="mono-label" style={{ margin: 0 }}>Where these come from</p>
          <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
            {provider.name === "mock"
              ? `Sample postings, for the demo. Live boards from ${boards.length} employers are next.`
              : "The workspace.jobsearch warehouse."}
          </p>
          <Link href="/dashboard" className="tb-btn tb-btn--sm mono-label" style={{ marginTop: "var(--space-24)" }}>
            Who you know at these &#8599;
          </Link>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Openings", value: String(ranked.length) },
          { label: "Open / soon", value: String(soon.length) },
          { label: "Verticals", value: verticals.length ? verticals.join(", ") : "all" },
          { label: "Source", value: provider.name },
        ]}
      />
    </div>
  );
}
