import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { getSession } from "@/lib/session";
import { confirmProfile } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { student, demo } = await getSession();
  if (!student) redirect("/sign-in?next=/onboarding/review");

  const { profile } = student;
  const a = profile.affinity;
  const known = [
    ...a.student_orgs, ...a.greek, ...a.case_competitions, ...a.programs,
    ...a.prior_employers, ...a.majors, ...a.certifications_in_progress,
  ].filter(Boolean).length;

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer">
        <div className="tb-wrap" style={{ maxWidth: 860 }}>
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Step two of two</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            Here is what<br />we read.
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: 0 }}>
            None of this becomes a question. Fix anything wrong in the next step.
          </p>
        </div>
      </section>

      {profile.uncertainties.length > 0 && (
        <section className="tb-band tb-band-top tb-layer">
          <div className="tb-wrap tb-panel" style={{ maxWidth: 860 }}>
            <p className="mono-label" style={{ color: "var(--alert)", margin: 0 }}>
              <span className="tb-led tb-led--alert" aria-hidden />{" "}
              {profile.uncertainties.length} thing{profile.uncertainties.length === 1 ? "" : "s"} we could not resolve
            </p>
            <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 var(--space-16)" }}>
              Each one becomes a question.
            </p>
            <ul className="body-sm" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "var(--space-8)" }}>
              {profile.uncertainties.map((note) => (
                <li key={note} style={{ color: "var(--ink-muted)" }}>&gt; {note}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap tb-cards tb-cards--2" style={{ maxWidth: 860 }}>
          <Facts title="You" items={[
            ["Name", profile.full_name], ["School", a.school_raw ?? profile.school],
            ["Graduating", profile.grad_date], ["Work authorisation", profile.work_auth],
          ]} />
          <Facts title="Study" items={[
            ["Majors", a.majors.join(", ")], ["Minors", a.minors.join(", ")],
            ["Certifications", a.certifications_in_progress.join(", ")],
          ]} />
          <Facts title="Affiliations" items={[
            ["Clubs and orgs", a.student_orgs.join(", ")], ["Greek", a.greek.join(", ")],
            ["Competitions", a.case_competitions.join(", ")], ["Programs", a.programs.join(", ")],
          ]} />
          <Facts title="Work" items={[
            ["Employers", [...new Set([...a.prior_employers, ...profile.experience.map((e) => e.employer)])].join(", ")],
            ["Clients and programmes", a.clients_and_programs.join(", ")],
            ["Projects", profile.projects.map((p) => p.name).join(", ")],
            ["Skills", profile.skills.slice(0, 8).join(", ")],
          ]} />
        </div>
      </section>

      <section className="tb-band tb-band-top tb-layer">
        <form action={confirmProfile} className="tb-wrap flex flex-wrap items-center gap-[var(--space-16)]" style={{ maxWidth: 860 }}>
          <button type="submit" className="tb-btn tb-btn--solid mono-label">
            Looks right &mdash; ask me the rest &#8599;
          </button>
        </form>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Facts extracted", value: String(known) },
          { label: "Unresolved", value: String(profile.uncertainties.length) },
          { label: "Skills", value: String(profile.skills.length) },
          { label: "Roles", value: String(profile.experience.length) },
        ]}
      />
    </div>
  );
}

function Facts({ title, items }: { title: string; items: [string, string | null | undefined][] }) {
  return (
    <section className="tb-panel">
      <h2 className="mono-label" style={{ margin: "0 0 var(--space-16)" }}>{title}</h2>
      <dl style={{ margin: 0, display: "grid", gap: "var(--space-12)" }}>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="mono-micro" style={{ color: "var(--ink-faint)" }}>{label}</dt>
            <dd className="body-sm" style={{ margin: "2px 0 0", color: value ? "var(--ink)" : "var(--ink-faint)" }}>
              {value || "we will ask"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
