import { expect, test } from '@playwright/test';

import { expectNoViolations, forceDarkTheme } from './navigation/nav-shared';

/**
 * Automated accessibility tests using axe-core.
 * Checks WCAG 2.1 AA compliance on key pages.
 *
 * Prerequisites:
 *   1. Build the site:  npx nx build astro
 *   2. Run tests:       npx playwright test --config=astro-docs/playwright.config.ts
 *
 * The Playwright config starts the Astro preview server automatically.
 */

const pages = [
  { name: 'Home', path: '/' },
  { name: 'Get Started', path: '/get-started/' },
  { name: 'Accessibility Statement', path: '/legal/accessibility-statement/' },
  { name: 'Enterprise', path: '/enterprise/' },
  { name: 'Events', path: '/events/' },
  { name: 'Resources', path: '/resources/' },
];

for (const { name, path } of pages) {
  test(`${name} (${path}) should have no WCAG AA violations`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page);
  });
}

/*
 * The Events redesign exists partly to clear a real color-contrast CI failure,
 * and Events deliberately stays teal in BOTH themes (it does NOT follow the
 * site-wide green dark accent). The light-mode `/events/` scan above is not
 * enough on its own: it leaves every dark pairing and the per-type filter
 * routes unverified. These scans cover dark mode and a type route so a
 * regression in either fails the gate.
 */
test('Events (/events/) should have no WCAG AA violations in dark mode', async ({
  page,
}) => {
  await forceDarkTheme(page);
  await page.goto('/events/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoViolations(page);
});

test('Events type route (/events/type/talk/) should have no WCAG AA violations', async ({
  page,
}) => {
  await page.goto('/events/type/talk/');
  await page.waitForLoadState('networkidle');
  await expectNoViolations(page);
});

test('Events type route (/events/type/talk/) should have no WCAG AA violations in dark mode', async ({
  page,
}) => {
  await forceDarkTheme(page);
  await page.goto('/events/type/talk/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoViolations(page);
});

/*
 * Resources mirrors the Events teal-token discipline and stays teal in BOTH
 * themes, so — exactly as for Events — the light-mode `/resources/` scan above
 * is not enough on its own. These scans cover dark mode and a type route
 * (multi-word slug `recorded-talk`) so a regression in either fails the gate.
 */
test('Resources (/resources/) should have no WCAG AA violations in dark mode', async ({
  page,
}) => {
  await forceDarkTheme(page);
  await page.goto('/resources/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoViolations(page);
});

test('Resources type route (/resources/type/recorded-talk/) should have no WCAG AA violations', async ({
  page,
}) => {
  await page.goto('/resources/type/recorded-talk/');
  await page.waitForLoadState('networkidle');
  await expectNoViolations(page);
});

test('Resources type route (/resources/type/recorded-talk/) should have no WCAG AA violations in dark mode', async ({
  page,
}) => {
  await forceDarkTheme(page);
  await page.goto('/resources/type/recorded-talk/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoViolations(page);
});
