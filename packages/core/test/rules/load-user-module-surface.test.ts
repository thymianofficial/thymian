import { describe, expect, it } from 'vitest';

// AC8: `unloadableReason` / `miscasedExtension` are exported for
// intra-package use only — never re-exported from the public @thymian/core
// surface. Import the package by its public specifier (resolved through the
// workspace symlink to the built `dist/index.js`, exactly like an external
// consumer would) rather than a relative src path, so this test actually
// exercises the public surface rather than the internal module.
describe('AC8: the seam predicate is not part of the public @thymian/core surface', () => {
  it('does not export unloadableReason or miscasedExtension from @thymian/core', async () => {
    // Deliberately importing the package's own public specifier rather than
    // a relative path — that is the entire point of this test, which checks
    // what an external consumer sees through `dist/index.js`, not what the
    // internal module graph exposes.
    // eslint-disable-next-line @nx/enforce-module-boundaries
    const importPublicCore = () => import('@thymian/core');
    const publicSurface: Record<string, unknown> = await importPublicCore();

    expect(publicSurface).not.toHaveProperty('unloadableReason');
    expect(publicSurface).not.toHaveProperty('miscasedExtension');
  });

  it('does not re-export the seam from the package index barrel', async () => {
    const packageIndex: Record<string, unknown> =
      await import('../../src/index.js');

    expect(packageIndex).not.toHaveProperty('unloadableReason');
    expect(packageIndex).not.toHaveProperty('miscasedExtension');
  });
});
