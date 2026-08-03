import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'line' : 'html',

  use: {
    /* Base URL from Astro preview server */
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },

  projects: [
    {
      // V2 (810x1080) and V3 (1280x800) both run here via per-file
      // `test.use({ viewport })` - only the V1 matrix file is excluded
      // (it needs real mobile context flags, not just a resized desktop
      // viewport).
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      testIgnore: '**/nav-matrix-v1.spec.ts',
    },
    {
      // No named Playwright device profile equals the spec's V1 pin
      // (390x844) - spread Pixel 7 for real chromium-native mobile
      // flags/UA, then override the viewport explicitly so a future
      // Playwright upgrade can't silently drift the matrix.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      testMatch: '**/nav-matrix-v1.spec.ts',
    },
  ],

  /* Start Astro preview server before tests run */
  webServer: {
    command: 'npx astro preview --port 4321',
    port: 4321,
    reuseExistingServer: !process.env['CI'],
  },
});
