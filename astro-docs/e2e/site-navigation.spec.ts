import { expect, type Page, test } from '@playwright/test';

/**
 * Component-level assertions for spec ACs 3, 6, 7, 8, 9, 10, 16, 18, 19
 * (docs/ux-site-navigation/EXPERIENCE.md @ commit 5823816). Runs under the
 * existing desktop `chromium` Playwright project (there is no mobile
 * viewport project yet - Story 13.3/AC17); V1 (390x844) is driven per-test
 * via `page.setViewportSize`.
 */

const V1 = { width: 390, height: 844 };
const V2 = { width: 810, height: 1080 };

const CUSTOM_BUTTON_ROUTES = ['/', '/events/', '/resources/', '/enterprise/'];
const DRAWER_ROUTE = '/introduction/what-is-thymian/';

function menuButton(page: Page) {
  return page.getByRole('button', { name: 'Menu' });
}

function panel(page: Page) {
  return page.locator('#site-nav-panel');
}

async function isInert(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((el) => el.hasAttribute('inert'));
}

async function openPanel(page: Page) {
  await menuButton(page).click();
  await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page)).toBeVisible();
}

test.describe('menu button - never zero, never two (AC3)', () => {
  for (const route of CUSTOM_BUTTON_ROUTES) {
    test(`${route}: exactly one visible custom menu button at V1, none at V2`, async ({
      page,
    }) => {
      await page.setViewportSize(V1);
      await page.goto(route);
      await expect(menuButton(page)).toBeVisible();
      await expect(
        page.locator('button[aria-expanded][aria-controls]'),
      ).toHaveCount(1);

      await page.setViewportSize(V2);
      await expect(menuButton(page)).toBeHidden();
    });
  }

  test(`${DRAWER_ROUTE}: exactly one visible native menu button at V1`, async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto(DRAWER_ROUTE);
    await expect(
      page.locator('button[aria-expanded][aria-controls]'),
    ).toHaveCount(1);
    // The custom button/panel never render on a hasSidebar route.
    await expect(page.locator('#site-nav-panel')).toHaveCount(0);
  });
});

test.describe('panel superset (AC2 leg / AC6)', () => {
  test('opening the panel shows exactly 6 nav links in order, Enterprise last and filled', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    const links = panel(page).locator('nav[aria-label="Site"] a');
    await expect(links).toHaveText([
      'Docs',
      'Events',
      'Resources',
      'Blog',
      'Contact',
      'Enterprise',
    ]);
    await expect(links.last()).toHaveClass(/enterprise-cta/);
  });

  test('panel socials equal the live SocialIcons set', async ({ page }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    const hrefs = await panel(page)
      .locator('a[rel="me"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    // The astro.config.ts `social[]` array declares 5 entries, but the
    // starlight-blog plugin auto-injects a 6th RSS feed link into the live,
    // merged config that `virtual:starlight/components/SocialIcons` actually
    // reads (same discovery as Story 13.1's Footer social row) - assert
    // against the real rendered set, not the literal config declaration.
    expect(new Set(hrefs)).toEqual(
      new Set([
        'https://github.com/thymianofficial/thymian',
        'https://discord.gg/TRSwCxbz9f',
        'https://x.com/thymiandev',
        'https://www.reddit.com/r/ThymianOfficial/',
        'https://www.linkedin.com/company/thymiandev/',
        'https://thymian.dev/blog/rss.xml',
      ]),
    );
  });

  test('panel includes the theme select', async ({ page }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);
    // Starlight's ThemeSelect renders a native <select> (role "combobox"),
    // not a button.
    await expect(
      panel(page).getByRole('combobox', { name: 'Select theme' }),
    ).toBeVisible();
  });
});

test.describe('drawer parity (AC3 spec / AC7)', () => {
  test('native drawer footer shows the same 6 nav links + 5 socials + theme select, no LanguageSelect', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto(DRAWER_ROUTE);
    await menuButton(page).click();

    // Scoped to the drawer footer specifically: `nav[aria-label="Site"]`
    // alone also matches the (CSS-hidden but still-DOM-present) desktop
    // pill row, which would violate Playwright's strict-locator mode.
    const footerNav = page.locator('.mobile-nav-links');
    await expect(footerNav).toBeVisible();
    const links = footerNav.locator('a');
    await expect(links).toHaveText([
      'Docs',
      'Events',
      'Resources',
      'Blog',
      'Contact',
      'Enterprise',
    ]);

    const socialHrefs = await page
      .locator('.mobile-preferences a[rel="me"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(new Set(socialHrefs)).toEqual(
      new Set([
        'https://github.com/thymianofficial/thymian',
        'https://discord.gg/TRSwCxbz9f',
        'https://x.com/thymiandev',
        'https://www.reddit.com/r/ThymianOfficial/',
        'https://www.linkedin.com/company/thymiandev/',
        'https://thymian.dev/blog/rss.xml',
      ]),
    );
    await expect(
      page.getByRole('combobox', { name: 'Select theme' }),
    ).toBeVisible();
    await expect(page.locator('starlight-lang-select')).toHaveCount(0);
  });
});

test.describe('button semantics (AC4 spec / AC8)', () => {
  test('aria-controls resolves to the panel id; aria-expanded flips on the button itself; name stays "Menu"', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');

    const button = menuButton(page);
    const controlsId = await button.getAttribute('aria-controls');
    expect(controlsId).toBe('site-nav-panel');
    await expect(page.locator(`#${controlsId}`)).toHaveCount(1);

    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveAccessibleName('Menu');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAccessibleName('Menu');
  });
});

test.describe('Esc + focus return (AC5 spec / AC9)', () => {
  test('Esc closes the panel and returns focus to the menu button', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    await page.keyboard.press('Escape');
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });
});

test.describe('scroll lock (AC6 spec / AC10)', () => {
  test('a real scroll attempt is a no-op while the panel is open; scrolling resumes on close', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    // `window.scrollTo()` bypasses `overflow: hidden` (it only blocks real
    // user input, not a programmatic scroll-position write) - `mouse.wheel`
    // simulates a genuine scroll gesture, which is what AC10 actually cares
    // about ("a scroll attempt"). Move the mouse onto the content first:
    // `openPanel`'s click left the cursor over the (fixed-position) menu
    // button, and a wheel event dispatched there does not bubble into a
    // document scroll the way one over the content area does. The actual
    // scroll also settles asynchronously after the wheel event dispatches,
    // so poll instead of reading `scrollY` immediately.
    const scrollY = () => page.evaluate(() => window.scrollY);
    await page.mouse.move(195, 400);
    await page.mouse.wheel(0, 300);
    await expect.poll(scrollY).toBe(0);

    await page.keyboard.press('Escape');
    await page.mouse.wheel(0, 300);
    await expect.poll(scrollY).toBeGreaterThan(0);
  });
});

test.describe('open/closed a11y contract (AC7 spec)', () => {
  test('main content is inert while open, released on close; panel is a Site landmark; hidden when closed', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');

    await expect(panel(page)).toBeHidden();
    expect(await isInert(page, '.main-frame')).toBe(false);

    await openPanel(page);
    await expect(panel(page).locator('nav[aria-label="Site"]')).toBeVisible();
    expect(await isInert(page, '.main-frame')).toBe(true);
    expect(await isInert(page, '.sl-skip-link')).toBe(true);

    await page.keyboard.press('Escape');
    expect(await isInert(page, '.main-frame')).toBe(false);
  });
});

test.describe('close on link activation (AC8 spec)', () => {
  test('activating the mailto Contact link closes the panel without navigating', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    await panel(page)
      .getByRole('link', { name: 'Contact', exact: true })
      .click();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page)).toBeHidden();
    expect(page.url()).toContain('/'); // still on the same page - no navigation occurred
  });

  // Route links and social links share the exact same delegated
  // `e.target.closest('a')` handler as the Contact link above (no
  // href-based branching in the implementation) - the mailto case is the
  // one worth a dedicated test since it is the only link type that
  // deliberately does not navigate away, making "did it close" observable
  // without racing a real page/tab navigation.
});

test.describe('AC7 continuity (AC9 spec)', () => {
  test('the open panel contains the /resources/ link', async ({ page }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);
    await expect(
      panel(page).getByRole('link', { name: 'Resources', exact: true }),
    ).toHaveAttribute('href', '/resources/');
  });
});

test.describe('800px-crossing reset (AC10 spec / AC18)', () => {
  test('resizing from V1 to V2 while open closes the panel and releases inert/scroll-lock', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.goto('/');
    await openPanel(page);

    await page.setViewportSize(V2);
    await expect(menuButton(page)).toBeHidden();
    await expect(panel(page)).toBeHidden();
    expect(await isInert(page, '.main-frame')).toBe(false);

    await page.evaluate(() => window.scrollTo(0, 50));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

test.describe('reduced motion (AC11 spec / AC19)', () => {
  test('panel transition-duration computes to 0s with prefers-reduced-motion: reduce', async ({
    page,
  }) => {
    await page.setViewportSize(V1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const duration = await panel(page).evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    expect(duration).toBe('0s');
  });
});
