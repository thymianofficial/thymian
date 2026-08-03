import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  expectNoViolations,
  forceDarkTheme,
  logoVisibleIntersectionWidth,
  ROUTES,
  SOCIAL_HREFS,
} from './nav-shared';

/**
 * V3 = 1280x800 (>=1152px band). Runs under the existing Desktop Chrome
 * `chromium` project, whose default viewport is already pinned to this size
 * (see playwright.config.ts) - no per-file `test.use()` needed here.
 */

const V2_VIEWPORT = { width: 810, height: 1080 };

const ALL_ROUTES = Object.values(ROUTES);

test.describe('per-cell chrome invariants (AC1, AC2, AC3, AC11, AC15)', () => {
  for (const route of ALL_ROUTES) {
    test(`${route}: loads, no menu button, logo floor, no overflow, no language select`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('.header').first()).toBeVisible();

      await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);

      const clientWidth = await page
        .locator('.title-wrapper')
        .evaluate((el) => el.clientWidth);
      expect(clientWidth).toBeGreaterThanOrEqual(120);
      expect(await logoVisibleIntersectionWidth(page)).toBeGreaterThanOrEqual(
        120,
      );

      await assertNoHorizontalOverflow(page);
      await expect(page.locator('starlight-lang-select')).toHaveCount(0);
    });
  }
});

test.describe('pills + CTA + socials (AC4, AC5, AC13)', () => {
  for (const route of ALL_ROUTES) {
    test(`${route}: pill set/order, CTA rightmost + white text light+dark, socials header-only`, async ({
      page,
    }) => {
      await page.goto(route);
      const pills = page.locator('nav[aria-label="Site"] .header-nav-link');
      await expect(pills).toHaveText([
        'Events',
        'Resources',
        'Blog',
        'Contact',
        'Enterprise',
      ]);

      const cta = page.locator('.header-nav-link.enterprise-cta');
      const pillXs = await pills.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().x),
      );
      const ctaX = await cta.evaluate((el) => el.getBoundingClientRect().x);
      expect(ctaX).toBe(Math.max(...pillXs));
      await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)');

      const headerHrefs = await page
        .locator('.social-icons a[rel="me"]:visible')
        .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
      expect(new Set(headerHrefs)).toEqual(new Set(SOCIAL_HREFS));
      const footerSocials = await page
        .locator('.footer-social-row a[rel="me"]:visible')
        .count();
      expect(footerSocials).toBe(0);

      await forceDarkTheme(page);
      await page.goto(route);
      await expect(page.locator('.header-nav-link.enterprise-cta')).toHaveCSS(
        'color',
        'rgb(255, 255, 255)',
      );
    });
  }
});

test.describe('compact-in-band sizing (AC4)', () => {
  test('V2 pill font-size is smaller than V3', async ({ page }) => {
    await page.setViewportSize(V2_VIEWPORT);
    await page.goto(ROUTES.R1);
    const v2Size = await page
      .locator('nav[aria-label="Site"] .header-nav-link')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(ROUTES.R1);
    const v3Size = await page
      .locator('nav[aria-label="Site"] .header-nav-link')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(v2Size).toBeLessThan(v3Size);
  });
});

test.describe('active pill (AC14)', () => {
  test('/events/ has aria-current=page + weight 600', async ({ page }) => {
    await page.goto(ROUTES.R4);
    const eventsPill = page
      .locator('nav[aria-label="Site"]')
      .getByRole('link', { name: 'Events', exact: true });
    await expect(eventsPill).toHaveAttribute('aria-current', 'page');
    expect(
      await eventsPill.evaluate((el) => getComputedStyle(el).fontWeight),
    ).toBe('600');
  });
});

test.describe('axe WCAG 2.1 AA (AC12)', () => {
  // Home's dark-mode base scan has a known, pre-existing, out-of-scope
  // content contrast bug - see thymianofficial/thymian#347. (The
  // Enterprise-page severity-badge variant of that issue, also tracked in
  // #347, is responsive-layout-dependent and does NOT reproduce at this
  // >=1152px band - verified directly, not assumed from the V2 finding.)
  for (const route of ALL_ROUTES) {
    test(`${route}: no violations, light`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoViolations(page);
    });

    const darkKnownIssue = route === ROUTES.R1;
    test(`${route}: no violations, dark`, async ({ page }) => {
      test.fixme(
        darkKnownIssue,
        'thymianofficial/thymian#347 - pre-existing dark-mode contrast bug, out of scope for the nav epic',
      );
      await forceDarkTheme(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoViolations(page);
    });
  }
});

test.describe('AC7 continuity - Resources pill is 1 click away (AC16)', () => {
  for (const route of ALL_ROUTES) {
    test(`${route}: Resources pill navigates directly`, async ({ page }) => {
      await page.goto(route);
      await page
        .locator('nav[aria-label="Site"]')
        .getByRole('link', { name: 'Resources', exact: true })
        .click();
      await expect(page).toHaveURL(/\/resources\/$/);
    });
  }
});
