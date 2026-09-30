import type { ReferralResult } from "@/lib/referral";

/**
 * Level colour is meaning, not decoration: the five levels borrow five steps
 * of the existing signal-to-alert hue scale (globals.css), strongest green.
 */
const HUE: Record<number, string> = { 5: "--tier-2", 4: "--tier-4", 3: "--tier-7", 2: "--tier-10", 1: "--tier-13" };
export const levelColor = (level: number) => `var(${HUE[level] ?? "--ink-faint"})`;

/** Five squares, filled to the level: legible before any text is read. */
export function ReferralBadge({ result }: { result: Pick<ReferralResult, "level" | "label" | "archetypeLabel"> }) {
  const color = levelColor(result.level);
  return (
    <span className="mono-label" title={`Likely to refer you: ${result.label} · ${result.archetypeLabel}`} style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-8)",
      border: `var(--border-2) solid ${color}`, color,
      padding: "var(--space-4) var(--space-10)", whiteSpace: "nowrap",
    }}>
      <span aria-hidden style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ width: 6, height: 6, background: i <= result.level ? color : "transparent", border: `1px solid ${color}` }} />
        ))}
      </span>
      <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{result.level}/5</span>
    </span>
  );
}
