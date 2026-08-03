import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Route classes R1-R6 from the matrix definitions (EXPERIENCE.md § Acceptance Criteria). */
export const ROUTES = {
  R1: '/',
  R2: '/introduction/what-is-thymian/',
  R3: '/blog/',
  R4: '/events/',
  R5: '/resources/',
  R6: '/enterprise/',
} as const;

/**
 * The declared `astro.config.ts` `social[]` array has 5 entries, but the
 * live/merged config actually consumed by `virtual:starlight/components/
 * SocialIcons` has 6: the `starlight-blog` plugin auto-injects an RSS feed
 * link (same discovery as Stories 13.1/13.2). Assert against this real
 * rendered set, not the literal config declaration.
 */
export const SOCIAL_HREFS = [
  'https://github.com/thymianofficial/thymian',
  'https://discord.gg/TRSwCxbz9f',
  'https://x.com/thymiandev',
  'https://www.reddit.com/r/ThymianOfficial/',
  'https://www.linkedin.com/company/thymiandev/',
  'https://thymian.dev/blog/rss.xml',
] as const;

/** Run the axe WCAG 2 A/AA scan and assert zero violations. */
export async function expectNoViolations(page: Page): Promise<void> {
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
export async function forceDarkTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('starlight-theme', 'dark');
    } catch {
      /* localStorage may be unavailable; the attribute below still applies. */
    }
    document.documentElement.dataset.theme = 'dark';
  });
}

/**
 * Open the custom sub-800px panel (R1/R4/R5/R6) and wait for it to settle -
 * including its opacity transition. `toBeVisible()` alone is satisfied the
 * instant the panel leaves `display: none`, which can be mid-fade; axe's
 * contrast checker samples actual rendered pixels, so scanning too early
 * reports a blended, artificially low-contrast color for the CTA instead of
 * its final, fully-opaque one.
 */
export async function openPanel(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Menu' });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const panelId = await button.getAttribute('aria-controls');
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('opacity', '1');
}

/** Open the native Starlight drawer (R2/R3) and wait for its footer content to settle. */
export async function openDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.mobile-nav-links')).toBeVisible();
}

/** AC11: no route may overflow the viewport horizontally. */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth > window.innerWidth : false;
  });
  expect(overflows).toBe(false);
}

/**
 * AC2 (logo floor): the intersection of the currently-visible logo image with
 * its clipping container (`.title-wrapper`) AND the viewport - a plain
 * bounding-box check on the logo alone passes on the shipped `overflow: clip`
 * zero-width bug, so this must intersect against the container too.
 */
export async function logoVisibleIntersectionWidth(
  page: Page,
): Promise<number> {
  const wrapperBox = await page.locator('.title-wrapper').boundingBox();
  const logoBox = await page
    .locator('.title-wrapper img:visible')
    .boundingBox();
  const viewport = page.viewportSize();
  if (!wrapperBox || !logoBox || !viewport) {
    return 0;
  }
  const left = Math.max(logoBox.x, wrapperBox.x, 0);
  const right = Math.min(
    logoBox.x + logoBox.width,
    wrapperBox.x + wrapperBox.width,
    viewport.width,
  );
  return Math.max(0, right - left);
}

/** AC4 (V1 leg): the desktop pill row must not be visible below 800px. */
export async function visiblePillCount(page: Page): Promise<number> {
  return page
    .locator('nav[aria-label="Site"] .header-nav-link:visible')
    .count();
}
