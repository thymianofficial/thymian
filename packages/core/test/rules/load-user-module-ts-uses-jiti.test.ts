import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

// The positive assertion ("a .ts rule loads") is not on its own a
// mutation-safe test: vitest transforms .ts on any dynamic import() through
// its own esbuild pipeline, so a mutation that swaps the jiti branch for
// native import() would still make a plain "does it load" test pass inside
// vitest — the exact "green against the wrong module" class the external
// built-loader harness exists to catch from outside the monorepo.
// This test closes that gap in-repo by spying on jiti itself and asserting
// it was actually invoked for the .ts path, not merely that loading
// succeeded.
const createJitiSpy = vi.fn();
const jitiImportSpy = vi.fn();

vi.mock('jiti', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jiti')>();

  return {
    ...actual,
    createJiti: (...args: Parameters<typeof actual.createJiti>) => {
      createJitiSpy();

      const real = actual.createJiti(...args);

      return {
        ...real,
        import: (...importArgs: Parameters<typeof real.import>) => {
          jitiImportSpy(...importArgs);

          return real.import(...importArgs);
        },
      };
    },
  };
});

describe('a .ts rule is routed through jiti, not native import()', () => {
  it('calls jiti.import with the canonical .ts path when loading a .ts rule', async () => {
    const { loadRules } = await import('../../src/rules/rule-loader.js');
    const tsPath = join(
      import.meta.dirname,
      'fixtures',
      'rules',
      'ts-rule.rule.ts',
    );

    const rules = await loadRules(tsPath);

    expect(rules).toEqual([
      expect.objectContaining({
        meta: expect.objectContaining({ name: 'ts-rule' }),
      }),
    ]);
    expect(createJitiSpy).toHaveBeenCalledTimes(1);
    expect(jitiImportSpy).toHaveBeenCalledWith(tsPath);
  });
});

describe('the underlying loader is invoked exactly once for concurrent loads of the same canonical path', () => {
  it('calls jiti.import exactly once when loadUserModule is called concurrently twice with the identical path', async () => {
    // Native import()/jiti's own module registries already dedupe by exact
    // resolved specifier once a path is canonical, so a counter incremented
    // inside the loaded module cannot distinguish "our in-flight map ran"
    // from "the layer below deduped it anyway". Spying on jiti.import's call
    // count instead proves OUR code only ever invokes the underlying loader
    // once — the actual job of the in-flight promise map — regardless
    // of what happens beneath it.
    const { loadUserModule, _resetUserModuleLoaderStateForTests } =
      await import('../../src/load-user-module.js');

    _resetUserModuleLoaderStateForTests();
    createJitiSpy.mockClear();
    jitiImportSpy.mockClear();

    const tsPath = join(
      import.meta.dirname,
      'fixtures',
      'rules',
      'exactly-once.rule.ts',
    );

    await Promise.all([loadUserModule(tsPath), loadUserModule(tsPath)]);

    expect(jitiImportSpy).toHaveBeenCalledTimes(1);
  });
});
