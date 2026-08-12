/**
 * Zero-dependency platform/limit constants for the Epic 11 promo-post module
 * (Story 11.1, AC1).
 *
 * NO IMPORTS AT ALL — deliberately, for the reason `promoStripLimit.ts` states
 * for itself: `promo-post.ts` (like `promoStripMeta.ts`) pulls in
 * `src/schema/event-date.ts`, which imports `z` from `astro:content` as a
 * runtime value that Playwright's plain Node ESM loader cannot resolve. This
 * module has no such import, so both `promo-post.ts` and a future Story 11.3
 * e2e suite can share one source of truth for the platform order and char
 * limits without either side re-declaring them.
 *
 * These values duplicate `PostText.astro`'s `CHAR_LIMITS` and
 * `PlatformSection.astro`'s `PLATFORM_CONFIG` (AD-8 forbids touching either
 * component). `PLATFORM_CONFIG.reddit` has no `charLimit` key at all, while
 * `CHAR_LIMITS.reddit` is `null` — `PLATFORM_CHAR_LIMITS.reddit: null` matches
 * both. The site-wide dedup of this now-five-file/nine-site duplication is a
 * deliberately deferred follow-up (see Story 11.1 Dev Notes), not this
 * story's job.
 */

/** The four supported promo platforms, in canonical/emission order. */
export const PROMO_PLATFORMS = ['reddit', 'x', 'linkedin', 'discord'] as const;

export type PromoPlatform = (typeof PROMO_PLATFORMS)[number];

/**
 * Platform-level character limits for the composed post BODY. reddit's body
 * has no hard limit (`null`); reddit's TITLE uses {@link REDDIT_TITLE_LIMIT}
 * instead.
 */
export const PLATFORM_CHAR_LIMITS = {
  reddit: null,
  x: 280,
  linkedin: 3000,
  discord: 2000,
} satisfies Record<PromoPlatform, number | null>;

/**
 * Reddit's title guideline (SKILL.md:131) is doc-only and enforced nowhere in
 * code today; this constant makes it a real, checkable limit.
 */
export const REDDIT_TITLE_LIMIT = 300;
