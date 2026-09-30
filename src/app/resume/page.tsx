import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { getPositionsProvider, rankPositions } from "@/lib/positions";
import { getSession } from "@/lib/session";
import { analyzeJob, tailorMode } from "@/lib/tailor";

export const dynamic = "force-dynamic";

const SHOWN = 12;

/**
 * Where the resume tailor starts: the student's best open matches, each one
 * click from a resume fitted to it. Applying stays with the student.
 */
export default async function ResumePage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/resume");

  const provider = getPositionsProvider();
  const scorable = { profile: student.profile, facts: student.facts };
  const positions = await provider.getPositions({ companies: student.facts.target_companies, limit: 8000 });
  const targets = new Set(student.facts.target_companies.map((c) => c.trim().toLowerCase()));
  const open = rankPositions(scorable, positions)
    .filter((r) => r.fit.windowStatus !== "closed")
    .sort((a, b) => Number(targets.has(b.position.company.toLowerCase())) - Number(targets.has(a.position.company.toLowerCase())) || b.fit.score - a.fit.score)
    .slice(0, SHOWN)
    .map((r) => ({ ...r, analysis: analyzeJob(scorable, r.position) }));

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav current="resume" signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap">
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Resume tailor</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>One resume<br />per posting.</h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            Pick an opening and your resume is rewritten for it: the posting analyzed, your closest experience first,
            stronger bullets, one clean page. It only uses what is on your profile, and asks you for the numbers instead
            of guessing them. You still send it yourself.
          </p>
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap">
          {open.length === 0 ? (
            <p className="body" style={{ color: "var(--ink-muted)" }}>No open postings right now. <Link className="tb-link" href="/jobs">See every opening</Link>.</p>
          ) : (
            <div className="tb-cards md:grid-cols-2 lg:grid-cols-3">
              {open.map(({ position, analysis }) => (
                <Link key={position.id} href={`/jobs/${position.id}/resume`} className="tb-card" style={{ color: "inherit", textDecoration: "none" }}>
                  <div className="flex items-start gap-[var(--space-12)]">
                    <CompanyLogo name={position.company} size={36} />
                    <div className="min-w-0">
                      <p className="title" style={{ textTransform: "uppercase", margin: 0 }}>{position.title}</p>
                      <p className="mono-micro truncate" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>{position.company}{position.location && <> &middot; {position.location}</>}</p>
                    </div>
                  </div>
                  <p className="mono-micro" style={{ margin: "var(--space-16) 0 0", color: "var(--ink-subtle)" }}>
                    {analysis.matchScore == null ? "Match unknown" : `Match ${analysis.matchScore}%`}
                    {" · "}{analysis.gaps.filter((g) => g.severity !== "minor").length} gap{analysis.gaps.filter((g) => g.severity !== "minor").length === 1 ? "" : "s"} that matter
                  </p>
                  <p className="mono-label" style={{ margin: "var(--space-12) 0 0", color: "var(--signal)" }}>Tailor &#8599;</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Openings", value: String(open.length) },
          { label: "Tailor", value: tailorMode() === "rules" ? "rules (no model)" : tailorMode() },
          { label: "Source", value: provider.name },
        ]}
      />
    </div>
  );
}
