import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Library convention is `test/**/*.test.ts`. `src/**` is collected too, deliberately: the
    // adjacent `rules-*` packages colocate tests in `src/`, and `tsconfig.lib.json` excludes
    // `src/**/*.test.ts` from the build — so a colocated test would otherwise be built by nothing
    // and collected by nothing, and `passWithNoTests` would still report the target green.
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
