import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: 'test/global.setup.ts',
    teardownTimeout: 10000,
    reporters: ['verbose'],
  },
});
