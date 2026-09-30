import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { windowLabel } from "@/components/opening-row";
import { PersonCard } from "@/components/person-card";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { rankPeople } from "@/lib/affinity/score";
import { KNOWN_COMPANIES, companyInfo, resolveCompanySlug, sameCompany } from "@/lib/companies";
import { loadCompanyPool, peopleAt, positionsAt } from "@/lib/companies/pool";
import { HomophilyWeightsForm } from "@/components/homophily-weights-form";
import { rankPeopleByHomophily } from "@/lib/homophily";
import { rankByReferral } from "@/lib/referral";
import { computeGaps } from "@/lib/intake/gaps";
import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { getSession } from "@/lib/session";
import { chooseCompany } from "../actions";

export const dynamic = "force-dynamic";

/**
 * One company: everyone there, most likely to refer first, plus its openings
 * and the questions that would move people up. The "everyone" ranking the
 * old dashboard led with survives only as a short tail — strong ties at other
 * companies are still worth a message, they are just not what this page is
 * for.
 */
export default async function CompanyPage({
  params, searchParams,
}: { params: Promise<{ company: string }>; searchParams: Promise<{ rank?: string }> }) {
  const { company: slug } = await params;
  const { rank } = await searchParams;
  // Two orders, one page. By default, who is most likely to refer the student
  // (src/lib/referral, 1 to 5); or the homophily total, with their weights.
  // The ladder still runs underneath: it writes the opening lines and decides
  // which questions would move people up.
  const byHomophily = rank === "homophily";
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/dashboard/${slug}`);

  const chosen = student.facts.target_companies;
  const pool = await loadCompanyPool(chosen);

  const name = resolveCompanySlug(slug, [...chosen, ...pool.companies.map((c) => c.name)])
    ?? KNOWN_COMPANIES.find((c) => c.slug === slug)?.name
    ?? null;
  if (!name) notFound();
  const info = companyInfo(name);
  const onList = chosen.some((c) => sameCompany(c, name));

  const scorable = { profile: student.profile, facts: student.facts };
  const here = peopleAt(pool.people, name);
  const { results, demand } = rankPeople(scorable, here);
  const byId = new Map(pool.people.map((p) => [p.id, p]));

  const homophily = rankPeopleByHomophily(student, here);
  const homophilyById = new Map(homophily.map((h) => [h.personId, h]));
  const ladderById = new Map(results.map((r) => [r.personId, r]));
  // Rated against the whole pool: closure counts warm contacts per company,
  // and the "elsewhere" list below needs the same ratings.
  const rated = rankByReferral(scorable, pool.people);
  const referralById = new Map(rated.map((r) => [r.personId, r]));
  const referral = rated.filter((r) => here.some((p) => p.id === r.personId));
  const strong = referral.filter((r) => r.level >= 3);
  const best = referral[0];
  // What the main list shows, in the chosen order.
  const listed = (byHomophily ? homophily.map((h) => h.personId) : referral.map((r) => r.personId))
    .map((id) => ({ id, result: ladderById.get(id)!, homophily: homophilyById.get(id), referral: referralById.get(id)! }));
  const here_ = `/dashboard/${slug}`;

  // Strong ties elsewhere: someone who managed you, a classmate, a real hook,
  // wherever they work now. They rate low here (not a company you picked),
  // but they are the people to ask who else to talk to.
  const WARM = new Set(["sponsor", "advocate", "peer", "warm_tie"]);
  const ladderAll = new Map(rankPeople(scorable, pool.people.filter((p) => !here.includes(p))).results.map((r) => [r.personId, r]));
  const elsewhere = rated.filter((r) => ladderAll.has(r.personId) && WARM.has(r.archetype)).slice(0, 4);

  const gaps = computeGaps({ profile: student.profile, facts: student.facts, meta: student.meta, demand });

  const openings = rankPositions(scorable, positionsAt(pool.positions, name), { allVerticals: true })
    .filter((r) => r.fit.windowStatus !== "closed")
    .sort((a, b) => a.position.opensOn.localeCompare(b.position.opensOn) || b.fit.score - a.fit.score)
    .slice(0, 10);

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label" href="/dashboard">&larr; Change company</Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-center justify-between gap-[var(--space-24)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <CompanyLogo name={info.name} size={56} />
              <div>
                <h1 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>{info.name}</h1>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-8) 0 0" }}>
                  {info.sector ?? "Your pick"} &middot; {results.length} {results.length === 1 ? "person" : "people"}
                  {openings.length > 0 && <> &middot; {openings.length} opening{openings.length === 1 ? "" : "s"}</>}
                </p>
              </div>
            </div>
            {!onList && (
              <form action={chooseCompany}>
                <input type="hidden" name="company" value={info.name} />
                <button type="submit" className="tb-btn tb-btn--solid mono-label">Add to my companies</button>
              </form>
            )}
          </div>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-24) 0 0" }}>
            {results.length === 0
              ? "Nobody here yet in the people we can reach. Add the company anyway and check back — or pick one where we have someone."
              : strong.length > 0
                ? `${strong.length} of them rate 3 or better out of 5 to refer you. Start with them.`
                : "Nobody rates above 2 out of 5 yet. The questions below are what would change that."}
          </p>
        </div>
      </section>


      {results.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <div className="flex flex-wrap items-end justify-between gap-[var(--space-16)]" style={{ marginBottom: "var(--space-24)" }}>
              <div>
                <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
                  People at {info.name}
                </h2>
                <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: 0 }}>
                  {byHomophily
                    ? "Most in common first \u00b7 every shared factor adds its weight"
                    : "Most likely to refer you first \u00b7 1 to 5 \u00b7 every card says why"}
                </p>
              </div>
              <div className="flex gap-[var(--space-8)]" role="group" aria-label="Rank by">
                <Link href={here_} className={`tb-btn tb-btn--sm mono-label${byHomophily ? "" : " tb-btn--solid"}`}
                  aria-current={byHomophily ? undefined : "true"}>Most likely to refer</Link>
                <Link href={`${here_}?rank=homophily`} className={`tb-btn tb-btn--sm mono-label${byHomophily ? " tb-btn--solid" : ""}`}
                  aria-current={byHomophily ? "true" : undefined}>Most in common</Link>
              </div>
            </div>
            {byHomophily && (
              <div style={{ marginBottom: "var(--space-24)" }}>
                <HomophilyWeightsForm weights={student.homophilyWeights} returnTo={`${here_}?rank=homophily`} />
              </div>
            )}
            <div className="tb-cards tb-cards--2">
              {listed.slice(0, 120).map(({ id, result, homophily: h, referral: ref }) => (
                <PersonCard key={id} person={byId.get(id)!} result={result} homophily={h} referral={ref}
                  badge={byHomophily ? "homophily" : "referral"} />
              ))}
            </div>
            {results.length > 120 && (
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                Showing the top 120 of {results.length}.
              </p>
            )}
          </div>
        </section>
      )}

      {(gaps.length > 0 || openings.length > 0) && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap tb-stack">
            {gaps.length > 0 && (
              <div className="tb-panel flex flex-wrap items-center justify-between gap-[var(--space-16)]">
                <div className="tb-copy">
                  <p className="mono-label" style={{ margin: 0 }}>
                    {gaps.length} question{gaps.length === 1 ? "" : "s"} outstanding
                  </p>
                  <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 0" }}>
                    {gaps[0].demandCount > 0 ? (
                      <>
                        Next: &ldquo;{gaps[0].field.question}&rdquo; &mdash; {gaps[0].demandCount}{" "}
                        {gaps[0].demandCount === 1 ? "person" : "people"} at {info.name} would move up if we knew.
                      </>
                    ) : (
                      "Each one adds people we can find."
                    )}
                  </p>
                </div>
                <Link className="tb-btn mono-label" href="/intake">Answer them &#8599;</Link>
              </div>
            )}

            {openings.length > 0 && (
              <div className="tb-panel">
                <div className="flex flex-wrap items-center justify-between gap-[var(--space-16)]">
                  <p className="mono-label" style={{ margin: 0 }}>&gt; Applications at {info.name}{getPositionsProvider().name === "databricks" ? <> &middot; Summer 2027 directory</> : <> &middot; sample postings</>}</p>
                  <Link className="tb-link mono-label" href="/jobs">All recommended &#8599;</Link>
                </div>
                <ul style={{ margin: "var(--space-16) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-12)" }}>
                  {openings.map(({ position, fit }) => (
                    <li key={position.id} className="flex flex-wrap items-baseline justify-between gap-[var(--space-12)]">
                      <span className="body-sm" style={{ margin: 0 }}>
                        <Link className="tb-link" href={`/jobs/${position.id}`}>{position.title}</Link>
                        {position.location && <span style={{ color: "var(--ink-faint)" }}> &middot; {position.location}</span>}
                      </span>
                      <span className="mono-micro" style={{ color: fit.windowStatus === "upcoming" ? "var(--ink-faint)" : "var(--alert)", whiteSpace: "nowrap" }}>
                        {windowLabel(fit)}{fit.datesKnown && <> &middot; {position.opensOn}</>}
                        {" "}&middot; <Link className="tb-link" href={`/jobs/${position.id}`}>What they want &middot; improve my chances &#8599;</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {elsewhere.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap">
            <h2 className="display-sm" style={{ textTransform: "uppercase", margin: "0 0 var(--space-8)" }}>
              Strong ties elsewhere
            </h2>
            <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "0 0 var(--space-24)" }}>
              Not at {info.name}, but the connection is real &middot; worth a message anyway
            </p>
            <div className="tb-cards tb-cards--2">
              {elsewhere.map((r) => <PersonCard key={r.personId} person={byId.get(r.personId)!} result={ladderAll.get(r.personId)!} referral={r} />)}
            </div>
          </div>
        </section>
      )}

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Company", value: info.name },
          { label: "People here", value: String(results.length) },
          { label: "Ranked by", value: byHomophily ? "homophily" : "likely to refer" },
          { label: "Strongest", value: byHomophily
              ? (homophily[0] ? `${homophily[0].totalScore} pts` : "None")
              : (best ? `${best.level} / 5` : "None") },
          { label: "Questions left", value: String(gaps.length) },
          { label: "Source", value: pool.peopleSource },
        ]}
      />
    </div>
  );
}
