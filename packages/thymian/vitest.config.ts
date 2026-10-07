import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    disableConsoleIntercept: true,
    // The command tests drive the full CLI, which on the Windows CI runners
    // takes seconds per test; vitest's 5 s unit-test default is too tight.
    testTimeout: 20_000,
  },
});
