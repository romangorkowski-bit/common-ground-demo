import { saveWeightsAction } from "@/app/dashboard/actions";
import { WEIGHT_LABELS, type HomophilyWeights } from "@/lib/homophily/scorer";

/**
 * The five weights, as a plain form. Saving re-ranks the page it sits on.
 * A student who wants former coworkers to matter more than a shared club
 * moves two numbers and sees the list change — that is the whole point of
 * the scorer taking custom weights.
 */
export function HomophilyWeightsForm({ weights, returnTo }: { weights: HomophilyWeights; returnTo: string }) {
  return (
    <form action={saveWeightsAction} className="tb-panel">
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="mono-label" style={{ margin: 0 }}>&gt; Your weights</p>
      <p className="body-sm" style={{ color: "var(--ink-muted)", margin: "var(--space-8) 0 var(--space-20)" }}>
        Each shared factor adds this many points, once per match. Set what matters to you.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-[var(--space-16)] sm:grid-cols-2 lg:grid-cols-5">
        {WEIGHT_LABELS.map(({ key, label, hint }) => (
          <label key={key} className="block">
            <span className="mono-micro block" style={{ marginBottom: "var(--space-8)" }}>{label}</span>
            <input name={key} type="number" min={0} max={100} step={1} defaultValue={weights[key]}
              className="tb-field" inputMode="numeric" />
            <span className="mono-micro block" style={{ marginTop: "var(--space-8)", color: "var(--ink-faint)", textTransform: "none" }}>
              {hint}
            </span>
          </label>
        ))}
      </div>
      <button type="submit" className="tb-btn tb-btn--solid mono-label" style={{ marginTop: "var(--space-20)" }}>
        Save and re-rank
      </button>
    </form>
  );
}
