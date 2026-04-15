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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start Astro preview server before tests run */
  webServer: {
    command: 'npx astro preview --port 4321',
    port: 4321,
    reuseExistingServer: !process.env['CI'],
  },
});
