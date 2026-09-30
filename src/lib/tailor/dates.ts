const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The formatter guide's date style, "Mon YYYY". Accepts the profile's ISO
 * forms ("2026-06", "2027-05-15") and anything already in that style; returns
 * null for what it cannot read, so the format check can say which date.
 */
export function monthYear(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (iso) {
    const m = Number(iso[2]);
    return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${iso[1]}` : null;
  }
  const named = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(value.trim());
  if (named) {
    const i = MONTHS.findIndex((m) => m.toLowerCase() === named[1].toLowerCase());
    return i >= 0 ? `${MONTHS[i]} ${named[2]}` : null;
  }
  return /^\d{4}$/.test(value.trim()) ? value.trim() : null;
}

/** "Jun 2026 – Aug 2026", "Jun 2026 – Present". */
export function dateRange(start: string | null, end: string | null): string {
  const s = monthYear(start) ?? start;
  const e = end ? monthYear(end) ?? end : start ? "Present" : null;
  return [s, e].filter(Boolean).join(" – ");
}
