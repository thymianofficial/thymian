import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
];

for (const { name, path } of pages) {
  test(`${name} (${path}) should have no WCAG AA violations`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

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
  });
}
