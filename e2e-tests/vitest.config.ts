import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: 'src/global.setup.ts',
    teardownTimeout: 10000,
    reporters: ['verbose'],
    env: {
      // Use the globally-installed binary by default.  The global install
      // is performed by the global setup against Verdaccio, so it is
      // always fresh.  npx tends to serve a stale cached package when the
      // version string (the committed `0.0.0-PLACEHOLDER`) doesn't change
      // between runs.
      THYMIAN_E2E_MODE: 'global',
    },
  },
});
