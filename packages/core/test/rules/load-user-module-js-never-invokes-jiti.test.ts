import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

// A JS-only run must never instantiate jiti. `jiti` is never imported
// statically anywhere in the seam — only ever via a dynamic `import('jiti')`
// inside the `.ts` dispatch branch — so mocking the whole module and
// spying on `createJiti` catches both an eager top-level instantiation and
// an unconditional call regardless of extension.
const createJitiSpy = vi.fn();

vi.mock('jiti', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jiti')>();

  return {
    ...actual,
    createJiti: (...args: Parameters<typeof actual.createJiti>) => {
      createJitiSpy();

      return actual.createJiti(...args);
    },
  };
});

describe('jiti is never instantiated for a JS-only run', () => {
  afterEach(() => {
    createJitiSpy.mockClear();
  });

  it('loads a built-in bare rule package and a .mjs rule without ever calling createJiti', async () => {
    const { loadRules } = await import('../../src/rules/rule-loader.js');
    const basePath = import.meta.dirname;

    await loadRules('@thymian/rules-rfc-9110');
    await loadRules(join(basePath, 'fixtures', 'rules', 'a.rule.mjs'));

    expect(createJitiSpy).not.toHaveBeenCalled();
  });
});
