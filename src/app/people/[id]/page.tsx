import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { Avatar } from "@/components/avatar";
import { ReferralBadge, levelColor } from "@/components/referral-badge";
import { scoreAffinity } from "@/lib/affinity/score";
import { getPeopleProvider } from "@/lib/people";
import { companyInfo } from "@/lib/companies";
import { computeGaps } from "@/lib/intake/gaps";
import { scorePersonByHomophily } from "@/lib/homophily";
import { NO_FACTORS } from "@/lib/homophily/scorer";
import { scoreReferral } from "@/lib/referral";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, demo } = await getSession();
  if (!student) redirect(`/sign-in?next=/people/${id}`);

  const provider = getPeopleProvider();
  const people = await provider.getPeople({ companies: student.facts.target_companies, limit: 2000 });
  const person = people.find((p) => p.id === id);
  if (!person) notFound();

  const result = scoreAffinity({ profile: student.profile, facts: student.facts }, person);
  const homophily = scorePersonByHomophily(student, person);
  // Closure counts warm contacts at their company, so the rating needs the pool.
  const referral = scoreReferral({ profile: student.profile, facts: student.facts }, person, people);
  // One list, strongest first: the ladder's evidence sentences, then the
  // homophily drivers that name anything the ladder did not phrase.
  const seen = new Set<string>();
  const inCommon = [
    ...result.evidence.map((e) => ({ text: e.label, rank: e.rank as number | null })),
    ...homophily.matchDrivers.filter((d) => d !== NO_FACTORS).map((d) => ({ text: d, rank: null as number | null })),
  ].filter((c) => {
    const key = c.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Only questions the questionnaire would still ask: a field the student
  // already answered, even with "none", is not something to send them back for.
  const open = new Set(computeGaps({ profile: student.profile, facts: student.facts, meta: student.meta }).map((g) => g.field.id));
  const unlockable = result.unlockable.filter((u) => open.has(u.fieldId));
  // The ladder's shared-employer copy is written for people who never
  // overlapped; someone who has seen the student's work needs the opposite.
  const outreach = referral.archetype === "sponsor"
    ? {
        ...result.outreach,
        opener: result.outreach.opener.replace(
          /^I worked at (.+) too — I saw you did as well\.$/,
          "We overlapped at $1 — I'd love to hear what you're working on now."),
        guidance: "You overlapped, so they can speak to your work. Remind them where your paths crossed before you ask for anything.",
      }
    : result.outreach;
  const companyPath = person.currentCompany ? `/dashboard/${companyInfo(person.currentCompany).slug}` : "/dashboard";

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="people" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <Link className="tb-link mono-label"
            href={person.currentCompany ? `/dashboard/${companyInfo(person.currentCompany).slug}` : "/dashboard"}>
            &larr; {person.currentCompany ? `Everyone at ${companyInfo(person.currentCompany).name}` : "Your dashboard"}
          </Link>
          <div className="mt-[var(--space-16)] flex flex-wrap items-start justify-between gap-[var(--space-16)]">
            <div className="flex items-center gap-[var(--space-16)]">
              <Avatar name={person.fullName} src={person.photoUrl} size={72} />
              <div>
                <h1 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>
                  {person.fullName}
                </h1>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "var(--space-12) 0 0" }}>
                  {person.currentTitle} &middot; {person.currentCompany}
                </p>
                {person.email && (
                  <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-8) 0 0", textTransform: "none" }}>
                    {person.email}
                  </p>
                )}
              </div>
            </div>
            <ReferralBadge result={referral} />
          </div>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid grid-cols-[minmax(0,1fr)] gap-[var(--space-32)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <div className="flex items-baseline justify-between gap-[var(--space-12)]">
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Why {referral.level} / 5 to refer you</p>
                <ReferralBadge result={referral} />
              </div>
              <h2 className="title" style={{ textTransform: "uppercase", margin: "var(--space-12) 0 0" }}>
                {referral.label} &middot; {referral.archetypeLabel}
              </h2>
              <ul className="body-sm" style={{ margin: "var(--space-12) 0 0", paddingLeft: "1.2em", color: "var(--ink-muted)", display: "grid", gap: "var(--space-8)" }}>
                {referral.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              {referral.contactSoon && (
                <p className="mono-label" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
                  <span className="tb-led tb-led--alert" aria-hidden /> {referral.contactSoon}
                </p>
              )}
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-12) 0 0", textTransform: "none" }}>
                5 has seen your work &middot; 4 an affinity group or close classmate &middot; 3 a warm tie &middot; 2 relevant but cold &middot; 1 no hook.
              </p>
            </div>

            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Your opening line</p>
              <blockquote className="mono-body" style={{
                margin: "var(--space-16) 0", padding: "var(--space-16)",
                background: "var(--canvas)", borderLeft: "var(--border-2) solid var(--rule-strong)",
                textTransform: "none",
              }}>
                {outreach.opener}
              </blockquote>
              <div className="tb-rule" style={{ paddingTop: "var(--space-16)" }}>
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>What to do with it</p>
                <p className="body-sm" style={{ margin: "var(--space-8) 0 0" }}>{outreach.guidance}</p>
                {outreach.timing && (
                  <p className="mono-label" style={{ color: "var(--alert)", margin: "var(--space-12) 0 0" }}>
                    <span className="tb-led tb-led--alert" aria-hidden /> {outreach.timing}
                  </p>
                )}
              </div>
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-16) 0 0", textTransform: "none" }}>
                A starting point, not a script. We do not send it for you.
              </p>
            </div>
          </div>

          <aside className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-24)] content-start">
            <div className="tb-panel">
              <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; What you have in common</p>
              {inCommon.length === 0 ? (
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
                  Nothing specific yet beyond wanting to work there. The questions below are what would find something.
                </p>
              ) : (
                <ul style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-10)" }}>
                  {inCommon.map((c) => (
                    <li key={c.text} style={{ display: "flex", gap: "var(--space-12)", alignItems: "flex-start" }}>
                      <span aria-hidden style={{ width: 8, height: 8, marginTop: 7, flexShrink: 0, background: c.rank ? levelColor(referral.level) : "var(--ink-faint)" }} />
                      <p className="body-sm" style={{ margin: 0 }}>{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-12) 0 0", textTransform: "none" }}>
                Strongest first.{" "}
                <Link href={`${companyPath}?rank=homophily`} className="tb-link" style={{ color: "var(--ink)", textTransform: "none" }}>
                  Weight what matters to you
                </Link>
              </p>
            </div>

            {unlockable.length > 0 && (
              <div className="tb-panel">
                <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; What would move them up</p>
                <ul className="body-sm" style={{ margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", color: "var(--ink-muted)", display: "grid", gap: "var(--space-8)" }}>
                  {unlockable.map((u) => (
                    <li key={u.fieldId}>{u.because} — tell us and they may rate higher.</li>
                  ))}
                </ul>
                <Link className="tb-btn tb-btn--sm mono-label" href="/intake" style={{ marginTop: "var(--space-16)" }}>
                  Answer those
                </Link>
              </div>
            )}
          </aside>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Likely to refer", value: `${referral.level} / 5` },
          { label: "Type", value: referral.archetypeLabel },
          { label: "Evidence", value: String(result.evidence.length) },
          { label: "Source", value: person.source },
        ]}
      />
    </div>
  );
}
