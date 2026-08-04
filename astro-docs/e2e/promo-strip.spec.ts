import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { forceDarkTheme } from './navigation/nav-shared';

/**
 * Mirrors `PROMO_EVENT_LIMIT` from
 * `../src/components/promo-strip/promoStripMeta.ts` (currently 3).
 * Deliberately NOT imported: that module resolves `classify` from
 * `src/schema/event-date.ts`, which does `import { z } from 'astro:content'`
 * as a real runtime value (not a type) - a virtual module Astro's own Vite
 * pipeline resolves but that Playwright's plain Node ESM loader cannot
 * ("Only URLs with a scheme in: file, data, and node are supported by the
 * default ESM loader. Received protocol 'astro:'"), confirmed by reproducing
 * the failure. No existing spec in this directory imports from `src/` for
 * the same reason. Keep this value in sync with the source by hand.
 */
const PROMO_EVENT_LIMIT = 3;

/**
 * Story 10.3 (Epic 10, thymian-internal#446): `PromoStrip.astro` (10.1/10.2)
 * renders on the homepage for the first time here, so its rendered/visual/
 * a11y/responsive verification lands in this story - 10.1/10.2 deliberately
 * shipped unit-test-only coverage.
 *
 * Scope:
 *  - Discovery (SM-2, <=2 clicks): every card link resolves to a real
 *    library index (never a `#` fragment), both targets return 200, each
 *    surfaced title from a real-content card (one with a `.promo-card-badge`)
 *    actually appears on its target index page, and the card count never
 *    exceeds `PROMO_EVENT_LIMIT + 1` (the events cap plus the one
 *    latest-Resource card).
 *  - The Resource card's stretched-link + independently-clickable secondary
 *    attribution link (guest-attributed resources with an `externalUrl`).
 *  - The strip's OWN a11y, scoped to `.promo-strip`, in both themes, at both
 *    the default desktop viewport (`chromium` project) and a mobile 390x844
 *    viewport - the narrowest width is where the `.promo-strip-list` CSS
 *    grid collapses to one column and where this repo's one known
 *    precedent contrast bug (#347) already lives.
 *
 * Deliberately NOT here: a whole-page Home dark-mode scan. The shared
 * `expectNoViolations` helper (`navigation/nav-shared.ts`) takes no selector
 * and always scans the whole page - using it on Home in dark mode would
 * re-trigger the OPEN, pre-existing, unrelated `thymianofficial/thymian#347`
 * (66 contrast nodes), already quarantined via `test.fixme` in
 * `navigation/nav-matrix-v1.spec.ts`. The existing light-mode whole-page
 * Home scan in `accessibility.spec.ts` is untouched by this story.
 */

test.describe('promo strip discovery (SM-2: any surfaced Event/Resource within 2 clicks)', () => {
  test('every card link resolves to /events/ or /resources/, both routes are 200, and each surfaced title appears on its target index', async ({
    page,
  }) => {
    await page.goto('/');

    const cardLinks = page.locator('.promo-strip .promo-card-link');
    const count = await cardLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // +1 accounts for the single latest-Resource card, which is independent
    // of the PROMO_EVENT_LIMIT event cap (see promoStripMeta.ts).
    expect(count).toBeLessThanOrEqual(PROMO_EVENT_LIMIT + 1);

    const entries = await cardLinks.evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute('href') ?? '',
        title: (link.textContent ?? '').trim(),
        // The evergreen fallback card (promoStripMeta.ts's zero-content
        // floor) has no `.promo-card-badge` sibling and renders fixed
        // marketing copy that is never drawn from /events/'s real body
        // text - only real-content cards get the title-on-target-page
        // assertion below.
        hasBadge:
          link.closest('.promo-card')?.querySelector('.promo-card-badge') !=
          null,
      })),
    );

    const titlesByTarget = new Map<string, string[]>();
    const targets = new Set<string>();
    for (const { href, title, hasBadge } of entries) {
      expect(['/events/', '/resources/']).toContain(href);
      targets.add(href);
      if (hasBadge) {
        const titles = titlesByTarget.get(href) ?? [];
        titles.push(title);
        titlesByTarget.set(href, titles);
      }
    }

    // Visit each distinct target once: confirm 200 (always), and that every
    // title routed there from a real-content card is actually present on
    // that index page (homepage -> 1 click -> the index -> the surfaced
    // item is present = 2 clicks, SM-2). A badge-less (evergreen) card's
    // href is still visited and 200-checked here, just not title-checked.
    for (const href of targets) {
      const response = await page.goto(href);
      expect(response?.status()).toBe(200);

      const titles = titlesByTarget.get(href);
      if (titles) {
        const bodyText = await page.locator('body').innerText();
        for (const title of titles) {
          expect(bodyText).toContain(title);
        }
      }
    }
  });
});

test.describe('promo card attribution link (stretched-link interaction)', () => {
  test('a guest attribution link, if present, stays independently clickable', async ({
    page,
  }) => {
    await page.goto('/');

    // `.promo-card-attribution-link` only renders for a Guest-attributed
    // resource with an `externalUrl` (PromoStrip.astro) - guard with a count
    // check rather than hard-failing if content ever changes and no such
    // resource exists.
    const attributionLink = page.locator(
      '.promo-strip .promo-card-attribution-link',
    );
    const count = await attributionLink.count();
    test.skip(
      count === 0,
      'no guest-attributed resource with an externalUrl in current content',
    );

    const link = attributionLink.first();
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).not.toBe('#');

    // Independently reachable, not nested inside another `<a>` (which would
    // be invalid HTML and would let the outer stretched
    // `.promo-card-link::after` overlay swallow clicks meant for this
    // secondary link) - asserted directly via the DOM rather than a full
    // navigation+back cycle.
    const nestedInAnchor = await link.evaluate(
      (el) => el.parentElement?.closest('a') != null,
    );
    expect(nestedInAnchor).toBe(false);
  });
});

/**
 * Assert `.promo-strip` is actually present (AC6 guard: a scoped axe scan
 * against a vanished/non-matching selector would otherwise just report zero
 * violations - false green, masking real breakage), then run the scoped
 * WCAG 2 A/AA scan against it.
 */
async function expectPromoStripHasNoViolations(page: Page): Promise<void> {
  await expect(page.locator('.promo-strip')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('.promo-strip')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('.promo-strip scoped a11y, both themes (AC6)', () => {
  test('light mode: no WCAG AA violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expectPromoStripHasNoViolations(page);
  });

  test('dark mode: no WCAG AA violations', async ({ page }) => {
    await forceDarkTheme(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expectPromoStripHasNoViolations(page);
  });
});

test.describe('.promo-strip scoped a11y, mobile viewport 390x844 (AC6)', () => {
  // Self-contained per-file override - playwright.config.ts only routes
  // nav-matrix-v1.spec.ts to the mobile-chromium project, so this spec
  // otherwise only ever runs under the desktop chromium project (1280x800).
  // Re-runs the same two scoped a11y checks at the narrowest supported
  // viewport, where the `.promo-strip-list` CSS grid collapses to one
  // column and where this repo's one known precedent contrast bug (#347)
  // already lives.
  test.use({ viewport: { width: 390, height: 844 } });

  test('light mode: no WCAG AA violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expectPromoStripHasNoViolations(page);
  });

  test('dark mode: no WCAG AA violations', async ({ page }) => {
    await forceDarkTheme(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expectPromoStripHasNoViolations(page);
  });
});
