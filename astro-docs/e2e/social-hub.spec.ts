import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import {
  PLATFORM_CHAR_LIMITS,
  PROMO_PLATFORMS,
  type PromoPlatform,
} from '../src/lib/promo-platforms';
import { forceDarkTheme } from './navigation/nav-shared';

/**
 * Rendered/a11y verification for Story 11.3's Events & Resources hub
 * (thymian-internal#449, AC14). `PlatformSection`/`PostText`/`SocialImage`/
 * `SocialLayout` are AD-8-frozen presentational components this spec never
 * edits — it only verifies what this story's own markup (`.hub-*`) does
 * with them.
 *
 * One event page (FrosCon — the only entry with a registered `LOGO_CREDITS`
 * licence line, AC9) and one resource page (the inherited-logo Resource)
 * cover "at least one event page, one resource page" per AC14.
 */
const EVENT_PATH = '/social/events-resources/events/froscon-community-booth/';
const RESOURCE_PATH =
  '/social/events-resources/resources/should-i-get-or-should-i-post-recording/';
const LANDING_PATH = '/social/events-resources/';

const HUB_ENTRY_PAGES = [
  { path: EVENT_PATH, label: 'event' },
  { path: RESOURCE_PATH, label: 'resource' },
];

// Mirrors promo-strip.spec.ts's module-load empty-set guard: fail loudly
// rather than silently registering zero tests. (PROMO_PLATFORMS is a fixed
// `as const` 4-tuple — its length is a compile-time literal, so a runtime
// emptiness check on it is unreachable by construction and not guarded
// here; HUB_ENTRY_PAGES below is the one genuinely runtime-derived list.)
if (HUB_ENTRY_PAGES.length === 0) {
  throw new Error(
    'HUB_ENTRY_PAGES is empty - this would silently register zero social-hub tests instead of failing loudly.',
  );
}

const REDDIT_INDEX = PROMO_PLATFORMS.indexOf('reddit');
if (REDDIT_INDEX === -1) {
  throw new Error(
    'PROMO_PLATFORMS no longer contains "reddit" - the licence-chain test below assumes reddit is one of the four platforms.',
  );
}

/** #447 AC7: reddit gets 2 blocks (title + body); every other platform 1. */
function expectedBlockCount(platform: PromoPlatform): number {
  return platform === 'reddit' ? 2 : 1;
}

const TOTAL_EXPECTED_BLOCKS = PROMO_PLATFORMS.reduce(
  (sum, platform) => sum + expectedBlockCount(platform),
  0,
);

/** The `.char-limit-hint` text `PlatformSection` renders for a platform with
 *  a char limit, or `null` for reddit (no limit -> no hint rendered at
 *  all). Derived from the imported `PLATFORM_CHAR_LIMITS`, never retyped, so
 *  it doubles as an order-and-identity fingerprint per section without a
 *  hand-authored platform label map. */
function expectedCharLimitHint(platform: PromoPlatform): string | null {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  return limit === null ? null : `max ${limit.toLocaleString()} chars`;
}

/**
 * AC6/AC7 structural assertions, run against a `.hub-entry` page (event or
 * resource): exactly one `noindex` meta tag, 4 `.platform-section`s in
 * `PROMO_PLATFORMS` order (verified via each section's `.char-limit-hint`,
 * never a hand-typed label map), 5 `.hub-post-editable` regions total with
 * 5 distinct `aria-label`s, exactly 1 `.hub-promo-image`, and no literal
 * "undefined" / empty `<dd>` in the header.
 */
async function expectHubEntryStructure(page: Page): Promise<void> {
  await expect(
    page.locator('meta[name="robots"][content="noindex, nofollow"]'),
  ).toHaveCount(1);

  const sections = page.locator('.hub-entry .platform-section');
  await expect(sections).toHaveCount(PROMO_PLATFORMS.length);

  const allEditable = page.locator('.hub-entry .hub-post-editable');
  await expect(allEditable).toHaveCount(TOTAL_EXPECTED_BLOCKS);

  for (const [index, platform] of PROMO_PLATFORMS.entries()) {
    const section = sections.nth(index);
    await expect(section.locator('.hub-post-editable')).toHaveCount(
      expectedBlockCount(platform),
    );

    const hint = section.locator('.char-limit-hint');
    const expectedHint = expectedCharLimitHint(platform);
    if (expectedHint === null) {
      await expect(hint).toHaveCount(0);
    } else {
      await expect(hint).toHaveText(expectedHint);
    }
  }

  await expect(page.locator('.hub-entry .hub-promo-image')).toHaveCount(1);

  const headerText = await page
    .locator('.hub-entry .hub-entry-header')
    .innerText();
  expect(headerText).not.toContain('undefined');
  expect(await page.locator('.hub-entry-header dd:empty').count()).toBe(0);

  const labels = await allEditable.evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label') ?? ''),
  );
  expect(labels).toHaveLength(TOTAL_EXPECTED_BLOCKS);
  expect(labels.every((label) => label.length > 0)).toBe(true);
  expect(new Set(labels).size).toBe(TOTAL_EXPECTED_BLOCKS);

  for (const region of await allEditable.all()) {
    await expect(region).toHaveAttribute('contenteditable', 'true');
  }
}

test.describe('hub entry page structure (AC1, AC3, AC6, AC7)', () => {
  for (const { path, label } of HUB_ENTRY_PAGES) {
    test(`${label} page: 1 image, ${PROMO_PLATFORMS.length} platform sections in order, ${TOTAL_EXPECTED_BLOCKS} editable regions, clean header`, async ({
      page,
    }) => {
      await page.goto(path);
      await expectHubEntryStructure(page);
    });
  }
});

test.describe('editable regions: contenteditable, focusable, distinct names (AC7)', () => {
  test('all editable regions on the event page are [contenteditable="true"], keyboard-focusable, with distinct aria-labels', async ({
    page,
  }) => {
    await page.goto(EVENT_PATH);

    const regions = page.locator('.hub-entry .hub-post-editable');
    await expect(regions).toHaveCount(TOTAL_EXPECTED_BLOCKS);

    const labels: string[] = [];
    for (const region of await regions.all()) {
      await expect(region).toHaveAttribute('contenteditable', 'true');
      await region.focus();
      await expect(region).toBeFocused();
      labels.push((await region.getAttribute('aria-label')) ?? '');
    }
    expect(new Set(labels).size).toBe(TOTAL_EXPECTED_BLOCKS);
  });
});

test.describe('copy-after-edit (AC7)', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test("typing into a region, then pressing its platform's Copy text button, copies the EDITED text", async ({
    page,
  }) => {
    await page.goto(EVENT_PATH);

    const region = page.locator('.hub-entry .hub-post-editable').first();
    const block = page.locator('.hub-entry .post-text-block').first();
    const copyButton = block.locator('.copy-btn');

    const originalText = await region.innerText();

    await region.click();
    await page.keyboard.type(' EDITED-BY-TEST');

    await copyButton.click();
    // PostText.astro's copy handler has no `.catch()` — assert the button
    // shows "Copied!" first (a denied clipboard write rejects silently and
    // never flips the label, which would otherwise fail as an opaque
    // timeout on the readText() call below).
    await expect(copyButton).toHaveText('Copied!');

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).not.toBe(originalText);
    expect(clipboardText).toContain('EDITED-BY-TEST');
  });
});

test.describe('discovery: /social/ -> /social/events-resources/ -> every entry (AC1, AC2, AC5)', () => {
  test('/social/ links to the landing page, and the landing page links every entry with a resolving, fragment-free href', async ({
    page,
  }) => {
    await page.goto('/social/');
    await expect(
      page.locator('a[href="/social/events-resources/"]').first(),
    ).toBeVisible();

    await page.goto(LANDING_PATH);
    await expect(page.locator('.hub-index')).toBeVisible();

    const links = page.locator(
      '.hub-index a[href^="/social/events-resources/"]',
    );
    const hrefs = await links.evaluateAll((as) =>
      as.map((a) => a.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(1);

    for (const href of hrefs) {
      expect(href).not.toContain('#');
      const response = await page.goto(href);
      expect(response?.status()).toBe(200);
      await expect(page.locator('.hub-entry')).toBeVisible();
    }
  });
});

test.describe('FrosCon licence chain (AC9)', () => {
  const FROSCON_IMAGE_CREDIT =
    'FrosCon logo © FrOSCon e.V., licensed under CC BY-ND 3.0 DE (https://creativecommons.org/licenses/by-nd/3.0/de/).';

  test("the complete 3-part notice appears once, as the final line of the final block of every platform section, and never in reddit's first block", async ({
    page,
  }) => {
    await page.goto(EVENT_PATH);

    const sections = page.locator('.hub-entry .platform-section');
    await expect(sections).toHaveCount(PROMO_PLATFORMS.length);

    for (const section of await sections.all()) {
      const blocks = section.locator('.post-text-content');
      const lastBlockText = await blocks.last().innerText();
      expect(lastBlockText).toContain(FROSCON_IMAGE_CREDIT);
    }

    const redditFirstBlockText = await sections
      .nth(REDDIT_INDEX)
      .locator('.post-text-content')
      .first()
      .innerText();
    expect(redditFirstBlockText).not.toContain(FROSCON_IMAGE_CREDIT);
  });
});

/**
 * Pre-existing color-contrast failures inside the hub subtree, owned by the
 * AD-8-frozen presentational components. A violation is ACCEPTED only if it
 * is `color-contrast` AND every one of its nodes is one of these classes.
 * Anything else is NEW and fails.
 */
const CONTRAST_BASELINE_CLASSES = [
  'char-counter',
  'char-limit-hint',
  'copy-btn',
  'platform-label',
] as const;

function newViolations(results: {
  violations: { id: string; nodes: { html: string }[] }[];
}) {
  return results.violations.filter(
    (v) =>
      v.id !== 'color-contrast' ||
      v.nodes.some(
        (n) =>
          !CONTRAST_BASELINE_CLASSES.some((c) =>
            new RegExp(`class="([^"]*\\s)?${c}(\\s[^"]*)?"`).test(n.html),
          ),
      ),
  );
}

/**
 * Assert the scan root is visible FIRST (a scoped scan against a
 * non-matching selector silently reports zero violations — false green),
 * then run the scoped WCAG 2 A/AA scan. `useBaseline` gates whether
 * pre-existing baseline `color-contrast` findings are filtered out
 * (`.hub-entry`) or not (`.hub-index`, which contains none of the 4 frozen
 * components and must return zero violations unconditionally).
 */
async function expectHubSubtreeClean(
  page: Page,
  selector: string,
  useBaseline: boolean,
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = useBaseline ? newViolations(results) : results.violations;
  expect(violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('.hub-entry scoped a11y, both themes, against the enumerated baseline (AC14)', () => {
  for (const { path, label } of HUB_ENTRY_PAGES) {
    test(`${label} page light mode: no NEW WCAG AA violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expectHubSubtreeClean(page, '.hub-entry', true);
    });

    test(`${label} page dark mode: no NEW WCAG AA violations`, async ({
      page,
    }) => {
      await forceDarkTheme(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      await expectHubSubtreeClean(page, '.hub-entry', true);
    });
  }
});

test.describe('.hub-index scoped a11y, both themes, ZERO violations with no allowlist (AC14)', () => {
  test('landing page light mode: zero violations', async ({ page }) => {
    await page.goto(LANDING_PATH);
    await page.waitForLoadState('networkidle');

    await expectHubSubtreeClean(page, '.hub-index', false);
  });

  test('landing page dark mode: zero violations', async ({ page }) => {
    await forceDarkTheme(page);
    await page.goto(LANDING_PATH);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await expectHubSubtreeClean(page, '.hub-index', false);
  });
});
