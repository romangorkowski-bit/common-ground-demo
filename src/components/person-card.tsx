import Link from "next/link";
import type { AffinityResult, Person } from "@/lib/affinity/types";
import { NO_FACTORS, type HomophilyResult } from "@/lib/homophily/scorer";
import { Avatar } from "./avatar";
import type { ReferralResult } from "@/lib/referral";
import { HomophilyBadge } from "./homophily-badge";
import { ReferralBadge } from "./referral-badge";

/**
 * One person. The badge is how likely they are to refer the student (1 to 5),
 * or the homophily total when the list is sorted that way; the body is why,
 * then what they share.
 */
/** Ladder evidence that is genuinely shared with the resume: not a post, an event, or "same field". */
const SHARED_KINDS = new Set(["school", "org", "employer", "client", "place", "interest"]);

/**
 * What the student and this person share, as sentences, strongest first:
 * the ladder's shared facts, then the homophily drivers that add a fact the
 * ladder did not already name (the two scorers describe the same university
 * in different words). Three lines at most on a card; nothing else.
 */
export function inCommonLines(result: AffinityResult, homophily?: HomophilyResult, max = 3): string[] {
  const out: string[] = [];
  for (const e of result.evidence) {
    if (SHARED_KINDS.has(e.kind) && !out.includes(e.label)) out.push(e.label);
  }
  const said = out.join(" | ").toLowerCase();
  for (const d of homophily?.matchDrivers ?? []) {
    if (d === NO_FACTORS) continue;
    const value = d.replace(/\s*\(\+\d+\)\s*$/, "").split(":")[1]?.trim().toLowerCase();
    if (value && said.includes(value)) continue;
    if (!value && /hometown/i.test(d) && result.evidence.some((e) => e.kind === "place")) continue;
    out.push(d);
  }
  return out.slice(0, max);
}

export function PersonCard({ person, result, homophily, referral, badge = "referral" }: {
  /** `result` is the ladder's evidence: what the two share, in sentences. */
  person: Person; result: AffinityResult; homophily?: HomophilyResult; referral: ReferralResult;
  /** Which score the badge shows — the one the list is ordered by. */
  badge?: "referral" | "homophily";
}) {
  const why = badge === "referral" ? `${referral.archetypeLabel}: ${referral.reasons[0]}` : null;
  const lines = why
    ? [why, ...inCommonLines(result, homophily).filter((l) => !why.includes(l))].slice(0, 3)
    : inCommonLines(result, homophily);
  return (
    <Link href={`/people/${person.id}`} className="tb-card">
      <div className="flex items-start justify-between gap-[var(--space-12)]">
        <div className="flex min-w-0 items-center gap-[var(--space-12)]">
          <Avatar name={person.fullName} src={person.photoUrl} size={40} />
          <div className="min-w-0">
            <p className="title" style={{ textTransform: "uppercase", margin: 0 }}>{person.fullName}</p>
            <p className="mono-micro truncate" style={{ color: "var(--ink-faint)", margin: "var(--space-4) 0 0" }}>
              {person.currentTitle} &middot; {person.currentCompany}
            </p>
          </div>
        </div>
        {badge === "homophily" && homophily ? <HomophilyBadge result={homophily} /> : <ReferralBadge result={referral} />}
      </div>

      {lines.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0" }}>
          Nothing in common yet beyond wanting to work there.
        </p>
      ) : (
        <ul className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-12) 0 0", padding: 0, listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {lines.map((d) => <li key={d}>&rarr; {d}</li>)}
        </ul>
      )}

    </Link>
  );
}
