import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { getPeopleProvider } from "@/lib/people";

/** Square with an inscribed crosshair — the system's own geometry. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M4 4h16v16H4z" /><path d="M4 12h16M12 4v16" />
    </svg>
  );
}

export interface NavProps {
  current?: "people" | "openings" | "profile";
  signedIn?: boolean;
  cta?: { label: string; href: string } | null;
  /** Whose account this is. Absent in demo mode, where there is no account. */
  email?: string | null;
}

export function Nav({ current, signedIn, cta, email }: NavProps) {
  return (
    <nav className="tb-nav tb-band-bottom tb-layer mono-label">
      <Link className="tb-nav__brand title" href="/">
        <Mark />
        Common Ground
      </Link>

      {signedIn ? (
        <div className="tb-nav__links">
          <NavLink href="/dashboard" active={current === "people"}>Dashboard</NavLink>
          <NavLink href="/jobs" active={current === "openings"}>Applications</NavLink>
          <NavLink href="/intake" active={current === "profile"}>Profile</NavLink>
        </div>
      ) : (
        <div className="tb-nav__links" />
      )}

      <div className="tb-nav__links" style={{ alignItems: "center", gap: "var(--space-16)" }}>
        {email && (
          <>
            {/* The address is reassurance, not navigation — first thing to go
                when the bar gets tight. The way out stays. */}
            <span className="mono-micro hidden lg:inline"
              style={{ color: "var(--ink-faint)", textTransform: "none" }}>
              {email}
            </span>
            <form action={signOut}>
              <button type="submit" className="tb-link mono-label" style={{ whiteSpace: "nowrap" }}>
                Sign out
              </button>
            </form>
          </>
        )}
        {cta === null ? null : (
          <Link className="tb-btn tb-btn--sm mono-label" href={cta?.href ?? "/sign-in"}>
            {cta?.label ?? "Sign in"}
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link className="tb-link" href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

export interface Diagnostic { label: string; value: React.ReactNode }

/**
 * The diagnostic strip. One per page.
 *
 * Every value here is measured by the app — people ranked, strongest tier
 * reached, questions outstanding, which provider answered. The system is blunt
 * about this: invented values are the difference between the page reading as
 * an instrument and reading as a costume.
 */
export function StatusFooter({
  readings, live = true,
}: { readings: Diagnostic[]; live?: boolean }) {
  const half = Math.ceil(readings.length / 2);
  const groups = [readings.slice(0, half), readings.slice(half)];

  return (
    <footer className="tb-status tb-band-top tb-layer mono-micro">
      {groups.map((group, i) => (
        <div className="tb-status__group" key={i}>
          {group.map((r) => (
            <span key={r.label}>{r.label}: {r.value}</span>
          ))}
          {i === 1 && (
            <span className="tb-status__pair">
              Status:{" "}
              <span className={`tb-led ${live ? "tb-led--live" : "tb-led--alert"}`} aria-hidden="true" />
              {live ? " Ranking" : " Demo"}
            </span>
          )}
        </div>
      ))}
    </footer>
  );
}

/**
 * Demo mode, stated as a machine line rather than a friendly toast. Only on
 * the bundled sample data: with the warehouse behind it there is nothing to
 * warn about, and the line would be the first thing on every page.
 */
export function DemoStrip() {
  if (getPeopleProvider().name !== "mock") return null;
  return (
    <div className="tb-band-bottom tb-layer mono-micro"
      style={{ padding: "var(--space-8) var(--space-24)", color: "var(--ink-faint)", textTransform: "uppercase" }}>
      <span className="tb-led tb-led--live" aria-hidden="true" />{" "}
      Portfolio demo &mdash; sample people and postings; your answers stay in this browser
    </div>
  );
}

/** Uppercase section heading with the machine-line marker. */
export function BandHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="display-sm" style={{ textTransform: "uppercase", margin: 0 }}>{children}</h2>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: "0 0 var(--space-16)" }}>
      &gt; {children}
    </p>
  );
}
