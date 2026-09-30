import Link from "next/link";
import { Nav } from "@/components/tb/chrome";

/** A dead link lands somewhere with a way back, not on the framework's bare 404. */
export default function NotFound() {
  return (
    <div className="tb-page" style={{ minHeight: "100vh" }}>
      <Nav signedIn cta={null} />
      <section className="tb-band tb-layer" style={{ flexGrow: 1 }}>
        <div className="tb-wrap">
          <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>&gt; 404</p>
          <h1 className="display-md" style={{ textTransform: "uppercase", margin: "var(--space-12) 0 var(--space-16)" }}>
            Nothing here.
          </h1>
          <p className="body tb-copy" style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-32)" }}>
            That person, opening or company is not in this demo, or the link is out of date.
          </p>
          <Link className="tb-btn tb-btn--solid mono-label" href="/dashboard">Back to your dashboard &#8599;</Link>
        </div>
      </section>
    </div>
  );
}
