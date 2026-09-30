import { canonical, sameEntity } from "@/lib/affinity/normalize";
import { cast as ladderCast, referralCast } from "@/lib/affinity/__fixtures__/cast";
import type { Person } from "@/lib/affinity/types";
import { demoShiftMs, shiftIso } from "@/lib/demo-clock";
import type { PeopleProvider, PeopleQuery } from "./types";

/**
 * The cast with its posts and events moved to the same distance from today
 * as from the day the fixtures were written, so a post "three days ago"
 * stays three days old and the decaying tiers never fade out of the demo.
 */
/** The ladder's eleven, plus the three the referral rating needs. */
const fixtureCast: readonly Person[] = [...ladderCast, ...referralCast];

export function currentCast(now = Date.now()): Person[] {
  const shift = demoShiftMs(now);
  if (shift === 0) return [...fixtureCast];
  return fixtureCast.map((p) => ({
    ...p,
    fetchedAt: shiftIso(p.fetchedAt, shift),
    posts: p.posts.map((post) => ({ ...post, publishedAt: shiftIso(post.publishedAt, shift) })),
    events: p.events.map((e) => ({ ...e, date: shiftIso(e.date, shift) })),
  }));
}

/**
 * The stage-safe provider: the eleven people the ladder test asserts on, plus
 * the three the referral rating test does.
 * If the demo drifts from the test, the test breaks — which is the point.
 */
export const mockPeopleProvider: PeopleProvider = {
  name: "mock",
  async getPeople({ companies, limit }: PeopleQuery): Promise<Person[]> {
    const cast = currentCast();
    if (!companies.length) return cast.slice(0, limit);
    const wanted = companies.map((c) => canonical("company", c));
    const matched = cast.filter((p) =>
      wanted.some((w) => sameEntity("company", w, canonical("company", p.currentCompany))));
    // People outside the target list still matter — a shared fraternity is a
    // shared fraternity wherever they work — so they are ranked, not filtered.
    const rest = cast.filter((p) => !matched.includes(p));
    return [...matched, ...rest].slice(0, limit);
  },
};
