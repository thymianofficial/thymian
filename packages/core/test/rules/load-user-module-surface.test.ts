import { describe, expect, it } from 'vitest';

// `unloadableReason` / `miscasedExtension` are exported for intra-package
// use only — never re-exported from the package's public barrel. We assert
// against `src/index.js` (the source barrel that `dist/index.js` is built
// from) rather than importing `@thymian/core`: an external-specifier import
// resolves to `dist/`, which would make this test depend on a prior build.
// Since the public surface is exactly whatever `src/index.js` re-exports,
// checking the source barrel is equivalent and build-free.
describe('the seam predicates are not part of the public surface', () => {
  it('does not re-export unloadableReason or miscasedExtension from the package index barrel', async () => {
    const packageIndex: Record<string, unknown> =
      await import('../../src/index.js');

    expect(packageIndex).not.toHaveProperty('unloadableReason');
    expect(packageIndex).not.toHaveProperty('miscasedExtension');
    expect(packageIndex).not.toHaveProperty('isLocalSpecifier');
    expect(packageIndex).not.toHaveProperty('resolveUserModule');
    expect(packageIndex).not.toHaveProperty('loadUserModule');
  });
});
