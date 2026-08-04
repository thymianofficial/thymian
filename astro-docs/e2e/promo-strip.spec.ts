import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { forceDarkTheme } from './navigation/nav-shared';

/**
 * Story 10.3 (Epic 10, thymian-internal#446): `PromoStrip.astro` (10.1/10.2)
 * renders on the homepage for the first time here, so its rendered/visual/
 * a11y/responsive verification lands in this story - 10.1/10.2 deliberately
 * shipped unit-test-only coverage.
 *
 * Scope:
 *  - Discovery (SM-2, <=2 clicks): every card link resolves to a real
 *    library index (never a `#` fragment), both targets return 200, and
 *    each surfaced title actually appears on its target index page.
 *  - The strip's OWN a11y, scoped to `.promo-strip`, in both themes.
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

    const entries = await cardLinks.evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute('href') ?? '',
        title: (link.textContent ?? '').trim(),
      })),
    );

    const titlesByTarget = new Map<string, string[]>();
    for (const { href, title } of entries) {
      expect(['/events/', '/resources/']).toContain(href);
      const titles = titlesByTarget.get(href) ?? [];
      titles.push(title);
      titlesByTarget.set(href, titles);
    }

    // Visit each distinct target once: confirm 200, and that every title
    // routed there is actually present on that index page (homepage -> 1
    // click -> the index -> the surfaced item is present = 2 clicks, SM-2).
    for (const [href, titles] of titlesByTarget) {
      const response = await page.goto(href);
      expect(response?.status()).toBe(200);
      const bodyText = await page.locator('body').innerText();
      for (const title of titles) {
        expect(bodyText).toContain(title);
      }
    }
  });
});

test.describe('.promo-strip scoped a11y, both themes (AC6)', () => {
  test('light mode: no WCAG AA violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .include('.promo-strip')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('dark mode: no WCAG AA violations', async ({ page }) => {
    await forceDarkTheme(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const results = await new AxeBuilder({ page })
      .include('.promo-strip')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
