/**
 * Cap on the number of Upcoming/Past Event cards the strip surfaces. A CAP,
 * never a fill target: with fewer Upcoming Events than this, the strip shows
 * fewer cards — it is never topped up from Past.
 *
 * Split into its own zero-dependency module — no `astro:content` import,
 * transitively or otherwise — so `e2e/promo-strip.spec.ts` can import the
 * real constant instead of hand-mirroring it. `promoStripMeta.ts` pulls in
 * `src/schema/event-date.ts`, which imports `z` from `astro:content` as a
 * runtime value that Playwright's plain Node ESM loader cannot resolve; this
 * module has no such import, so both sides can share one source of truth.
 */
export const PROMO_EVENT_LIMIT = 3;
