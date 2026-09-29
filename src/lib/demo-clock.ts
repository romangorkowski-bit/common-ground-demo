import { NOW as FIXTURE_NOW } from "@/lib/affinity/__fixtures__/cast";

/**
 * Keeps the bundled sample data current, so the demo never needs updating.
 *
 * The fixtures were written around 2026-09-19 with a class-of-2027 student.
 * Scoring reads the real clock, so without this a post "three days ago"
 * would slowly decay into last year's news. Mock providers shift their dates
 * by these amounts; tests import the fixtures directly and are unaffected.
 */

/** How far the real clock is past the day the fixtures were written. Never negative. */
export function demoShiftMs(now = Date.now()): number {
  return Math.max(0, now - FIXTURE_NOW);
}

/** The class year of a student starting junior-year recruiting today: next spring's graduates. */
export function demoGradYear(now = Date.now()): number {
  const d = new Date(now);
  return d.getUTCMonth() >= 5 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}

/** Years to add to any class year in the fixtures (which assume 2027). */
export function demoYearShift(now = Date.now()): number {
  return Math.max(0, demoGradYear(now) - 2027);
}

/** An ISO timestamp moved forward by `shiftMs`; anything unparseable is returned as is. */
export function shiftIso(iso: string, shiftMs: number): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) || shiftMs === 0 ? iso : new Date(t + shiftMs).toISOString();
}

/** A `YYYY-...` date string with its year moved forward by `years`. */
export function shiftYear(date: string | null, years: number): string | null {
  if (!date || years === 0) return date;
  const m = /^(\d{4})(.*)$/.exec(date);
  return m ? `${Number(m[1]) + years}${m[2]}` : date;
}
