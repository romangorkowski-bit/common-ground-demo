import Link from "next/link";
import { Nav, StatusFooter } from "@/components/tb/chrome";
import { Hero } from "@/components/tb/hero";
import { LiveClock } from "@/components/tb/live-clock";
import { FIELDS } from "@/lib/intake/fields";
import { getSession } from "@/lib/session";

/**
 * Per-student, so never prerendered. In demo mode getSession() answers from
 * memory without touching cookies, which is enough for Next to treat this page
 * as static and bake one student's ranking into the build.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { demo, student } = await getSession();
  // With Supabase configured an account comes first; in demo mode the proxy
  // has already given this browser its own private student, so straight in.
  const start = demo || student ? "/onboarding/upload" : "/sign-up";

  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      <Nav signedIn={Boolean(student)} email={demo ? null : student?.email}
        cta={demo || student ? null : { label: "Sign in", href: "/sign-in" }} />

      <Hero
        picture="/hands.png"
        marble="/marble.png"
        head={<>Find genuine<br />connections.</>}
        lines={["> rating every connection 1 to 5_"]}
        note="Two minutes &middot; We only ask what your resume does not already say"
      >
        <Link className="tb-btn tb-btn--solid mono-label" href={start}>{demo ? "Try the demo" : student ? "Upload your resume" : "Make an account"} &#8599;</Link>
      </Hero>

      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap grid grid-cols-[minmax(0,1fr)] gap-[var(--space-32)] md:grid-cols-3">
          <Point n="01" title="We read your resume first">
            Everything on it becomes something we can match on. Then we ask, once, for what a
            resume never carries.
          </Point>
          <Point n="02" title="We rank who will refer you">
            Everyone gets a 1 to 5: someone who has seen your work beats a close classmate, who
            beats a stranger in your field. Every rating says why.
          </Point>
          <Point n="03" title="You send the message">
            We draft an opening line from what you share. We never send anything.
          </Point>
        </div>
      </section>


      <section className="tb-band tb-band-top tb-layer">
        <div className="tb-wrap" style={{ textAlign: "center" }}>
          <h2 className="display-md" style={{ textTransform: "uppercase", margin: 0 }}>
            Start in your first year.
          </h2>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "var(--space-16) auto var(--space-32)" }}>
            Not the week applications open. The advantage is in having talked to people before the
            posting went up.
          </p>
          <Link className="tb-btn tb-btn--solid mono-label" href={start}>{demo ? "Try the demo" : "Upload your resume"} &#8599;</Link>
        </div>
      </section>

      <StatusFooter
        live={!demo}
        readings={[
          { label: "Rating", value: "1 to 5" },
          { label: "Questions", value: `${FIELDS.length} max` },
          { label: "UTC", value: <LiveClock zone="utc" /> },
          { label: "Local", value: <LiveClock /> },
        ]}
      />
    </div>
  );
}

function Point({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mono-micro" style={{ color: "var(--ink-faint)", margin: 0 }}>{n}</p>
      <h3 className="title" style={{ textTransform: "uppercase", margin: "var(--space-8) 0 var(--space-12)" }}>
        {title}
      </h3>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: 0 }}>{children}</p>
    </div>
  );
}
