import { expect, type Page, test } from '@playwright/test';

/**
 * Component-level assertions for spec ACs 2, 4, 5 (V2/V3 legs), 13, 14, 15
 * (docs/ux-site-navigation/EXPERIENCE.md @ commit 5823816). Runs under the
 * existing desktop `chromium` project; viewports are set per test.
 *
 * The exhaustive V1/V2/V3 x R1-R6 matrix and the mobile Playwright project
 * are Story 13.3 - not built here.
 */

const V2 = { width: 810, height: 1080 };
const V3 = { width: 1280, height: 800 };

/**
 * Force Starlight's dark theme (copied from accessibility.spec.ts's
 * forceDarkTheme helper - kept local so that spec file stays untouched).
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

function siteNav(page: Page) {
  return page.locator('nav[aria-label="Site"]');
}

function ctaPill(page: Page) {
  return page.locator('.header-nav-link.enterprise-cta');
}

async function visibleHrefs(
  page: Page,
  containerSelector: string,
): Promise<string[]> {
  return page
    .locator(`${containerSelector} a[rel="me"]:visible`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
}

/** Intersection of the currently-visible logo image with its clipping container and the viewport. */
async function logoVisibleIntersectionWidth(page: Page): Promise<number> {
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

for (const [label, viewport] of [
  ['V2', V2],
  ['V3', V3],
] as const) {
  test(`${label}: pill set/order + min-height >= 24px (AC2)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const pills = siteNav(page).locator('.header-nav-link');
    await expect(pills).toHaveText([
      'Events',
      'Resources',
      'Blog',
      'Contact',
      'Enterprise',
    ]);
    const heights = await pills.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(24);
    }
  });

  test(`${label}: logo floor - title-wrapper clientWidth >= 120 AND visible intersection >= 120 (AC3)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const clientWidth = await page
      .locator('.title-wrapper')
      .evaluate((el) => el.clientWidth);
    expect(clientWidth).toBeGreaterThanOrEqual(120);
    expect(await logoVisibleIntersectionWidth(page)).toBeGreaterThanOrEqual(
      120,
    );
  });

  test(`${label}: no language-select control in header or footer (AC15)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('header starlight-lang-select')).toHaveCount(0);
    await expect(page.locator('footer starlight-lang-select')).toHaveCount(0);
  });
}

test('V2 pill font-size is smaller than V3 (AC2, compact-in-band)', async ({
  page,
}) => {
  await page.setViewportSize(V2);
  await page.goto('/');
  const v2Size = await siteNav(page)
    .locator('.header-nav-link')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.setViewportSize(V3);
  await page.goto('/');
  const v3Size = await siteNav(page)
    .locator('.header-nav-link')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  expect(v2Size).toBeLessThan(v3Size);
});

test('V3: socials header-only; V2: socials footer-only; identical href set (AC4/AC5)', async ({
  page,
}) => {
  await page.setViewportSize(V3);
  await page.goto('/');
  const headerHrefsV3 = await visibleHrefs(page, '.social-icons');
  const footerHrefsV3 = await visibleHrefs(page, '.footer-social-row');
  expect(headerHrefsV3.length).toBeGreaterThan(0);
  expect(footerHrefsV3).toEqual([]);

  await page.setViewportSize(V2);
  await page.goto('/');
  const headerHrefsV2 = await visibleHrefs(page, '.social-icons');
  const footerHrefsV2 = await visibleHrefs(page, '.footer-social-row');
  expect(headerHrefsV2).toEqual([]);
  expect(footerHrefsV2.length).toBeGreaterThan(0);

  expect(new Set(footerHrefsV2)).toEqual(new Set(headerHrefsV3));
});

for (const [label, viewport] of [
  ['V2', V2],
  ['V3', V3],
] as const) {
  test(`${label}: Enterprise CTA contract - white text + rightmost + pinned dark fills (AC13)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    // Light, rest. The mouse starts at (0, 0) on a fresh page/context, well
    // away from the CTA, so this reads a genuine (non-hover) rest state.
    // `toHaveCSS` polls until the value settles, riding out the 0.15s
    // color/background-color transition instead of racing it.
    await page.goto('/');
    const cta = ctaPill(page);
    await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)');

    const pillXs = await siteNav(page)
      .locator('.header-nav-link')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
    const ctaX = await cta.evaluate((el) => el.getBoundingClientRect().x);
    expect(ctaX).toBe(Math.max(...pillXs));

    // Light, hover
    await cta.hover();
    await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)');

    // The mouse is now resting over the CTA's screen position. `page.goto()`
    // does NOT move it away, so the upcoming dark-mode reload would otherwise
    // paint straight into `:hover` unless the mouse is moved off first.
    await page.mouse.move(0, 0);

    // Dark, rest
    await forceDarkTheme(page);
    await page.goto('/');
    const ctaDark = ctaPill(page);
    expect(await ctaDark.evaluate((el) => el.matches(':hover'))).toBe(false);
    await expect(ctaDark).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(ctaDark).toHaveCSS('background-color', 'rgb(55, 110, 27)');

    // Dark, hover
    await ctaDark.hover();
    await expect(ctaDark).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(ctaDark).toHaveCSS('background-color', 'rgb(39, 81, 20)');
  });
}

test('V3: /events/ has aria-current=page + weight 600; /events/type/talk/ has aria-current=true (AC14)', async ({
  page,
}) => {
  await page.setViewportSize(V3);

  await page.goto('/events/');
  const eventsPill = siteNav(page).getByRole('link', {
    name: 'Events',
    exact: true,
  });
  await expect(eventsPill).toHaveAttribute('aria-current', 'page');
  expect(
    await eventsPill.evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe('600');

  await page.goto('/events/type/talk/');
  await expect(eventsPill).toHaveAttribute('aria-current', 'true');
});

test('the mailto: Contact pill never carries aria-current (AC14)', async ({
  page,
}) => {
  await page.setViewportSize(V3);
  await page.goto('/events/');
  const contactPill = siteNav(page).getByRole('link', {
    name: 'Contact',
    exact: true,
  });
  await expect(contactPill).not.toHaveAttribute('aria-current');
});

test('specificity-trap regression: on /enterprise/ the CTA keeps white text in light AND dark despite aria-current=page (AC13/AC14)', async ({
  page,
}) => {
  await page.setViewportSize(V3);

  await page.goto('/enterprise/');
  const cta = ctaPill(page);
  await expect(cta).toHaveAttribute('aria-current', 'page');
  await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)');

  await forceDarkTheme(page);
  await page.goto('/enterprise/');
  const ctaDark = ctaPill(page);
  await expect(ctaDark).toHaveAttribute('aria-current', 'page');
  await expect(ctaDark).toHaveCSS('color', 'rgb(255, 255, 255)');
});
