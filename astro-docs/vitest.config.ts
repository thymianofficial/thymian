import { getViteConfig } from 'astro/config';

// `getViteConfig` wires up Astro's vite plugins so the `astro:content` virtual
// module (which re-exports `z`) resolves inside vitest. This file is excluded
// from `astro check` (see tsconfig `exclude`): Astro bundles its own nested
// `vite`, distinct from the root `vite`, so the `UserConfigFn`/`test` types
// cannot reconcile under the type-checker — a tooling-only quirk that does not
// affect the product build or the vitest run.
export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
