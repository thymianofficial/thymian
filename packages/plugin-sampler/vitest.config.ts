import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // `@oclif/test`'s `captureOutput` (gate-exit-code.test.ts) monkeypatches
    // `process.stdout.write` to capture a command's `this.log()` output.
    // Vitest's own console interception captures via a reference to the
    // original stream, ahead of that patch, so it must be off for the
    // capture to see anything (mirrors packages/thymian's vitest.config.ts,
    // which runs the same kind of in-process command test).
    disableConsoleIntercept: true,
  },
});
