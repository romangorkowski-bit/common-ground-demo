import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoStrip, Nav, StatusFooter } from "@/components/tb/chrome";
import { FIELDS } from "@/lib/intake/fields";
import { getResumeProvider } from "@/lib/resume";
import { getSession } from "@/lib/session";
import { startWithSampleStudent } from "../actions";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";
/** The model calls behind this page can take longer than a default function budget. */
export const maxDuration = 60;

export default async function UploadPage() {
  const { demo, student } = await getSession();
  if (!student) redirect("/sign-in?next=/onboarding/upload");
  const derivable = FIELDS.filter((f) => f.resumeDerivable).length;
  const reader = getResumeProvider();

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      {demo && <DemoStrip />}
      <Nav signedIn cta={null} email={demo ? null : student.email} />

      <section className="tb-band tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap" style={{ maxWidth: 620 }}>
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; Step one of two</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-16) 0" }}>
            Start with<br />your resume.
          </h1>
          {reader.isReady() ? (
            <>
              <p className="body" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-32)" }}>
                Your school, employers and clubs become things we can match on. {derivable} of our{" "}
                {FIELDS.length} questions are answered from it.
              </p>

              <UploadForm reader={reader.name} />

              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-24) 0 0", textTransform: "none" }}>
                &gt; Stored privately. Never sent anywhere on your behalf.
              </p>

              <div className="tb-rule" style={{ marginTop: "var(--space-32)", paddingTop: "var(--space-24)" }}>
                <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>
                  No PDF handy?{" "}
                  <Link href="/onboarding/review" className="tb-link" style={{ color: "var(--ink)" }}>
                    Continue with what we have
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="body" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-16)" }}>
                In the full app a model reads your PDF, and your school, employers and clubs become things we
                can match on: {derivable} of our {FIELDS.length} questions are answered from it.
              </p>
              <p className="body" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-32)" }}>
                This demo has no model attached, so it starts from a sample student whose resume has already
                been read. Everything after this step is the real flow.
              </p>

              <form action={startWithSampleStudent}>
                <button type="submit" className="tb-btn tb-btn--solid mono-label">Use the sample student &#8599;</button>
              </form>

              <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: "var(--space-24) 0 0", textTransform: "none" }}>
                &gt; Sam Rivera &middot; Virginia Tech &middot; finance, aiming for consulting. Your answers stay in this browser.
              </p>
            </>
          )}
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Accepts", value: "PDF / 15MB" },
          { label: "Fields from resume", value: `${derivable} of ${FIELDS.length}` },
          { label: "Reader", value: reader.isReady() ? reader.name : "sample student" },
        ]}
      />
    </div>
  );
}
