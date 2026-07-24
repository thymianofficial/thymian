import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

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

/** Run the axe WCAG 2 A/AA scan and assert zero violations. */
async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
  }));

  expect(violations, `Found ${violations.length} a11y violation(s)`).toEqual(
    [],
  );
}

/**
 * Force Starlight's dark theme. Starlight keys its theme off a `data-theme`
 * attribute on `<html>` and persists the choice in the `starlight-theme`
 * localStorage key; seeding both before navigation means Starlight's own inline
 * theme script applies dark on load (and stays dark through any client re-run).
 */
async function forceDarkTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('starlight-theme', 'dark');
    } catch {
      /* localStorage may be unavailable; the attribute below still applies. */
    }
    document.documentElement.dataset.theme = 'dark';
  });
}

const pages = [
  { name: 'Home', path: '/' },
  { name: 'Get Started', path: '/get-started/' },
  { name: 'Accessibility Statement', path: '/legal/accessibility-statement/' },
  { name: 'Enterprise', path: '/enterprise/' },
  { name: 'Events', path: '/events/' },
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
