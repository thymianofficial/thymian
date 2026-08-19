import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join } from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadUserModule, resolveUserModule } from '../src/load-user-module.js';

const fixtures = join(import.meta.dirname, 'fixtures', 'user-modules');

const BARE_PACKAGE = '@thymian/rules-rfc-9110';

/**
 * Resolves a specifier and asserts the contract every resolvable case shares: a defined,
 * absolute filesystem path that is never a `file://` URL. `loadRuleSet` feeds this value
 * straight into `path.dirname` as a glob base, so a URL leaking through here would break
 * every rule-set glob rather than fail loudly.
 */
async function resolveOrFail(
  specifier: string,
  cwd: string = fixtures,
): Promise<string> {
  const resolved = await resolveUserModule(specifier, cwd);

  if (resolved === undefined) {
    throw new Error(`Expected "${specifier}" to resolve from ${cwd}.`);
  }

  expect(isAbsolute(resolved)).toBe(true);
  expect(resolved.startsWith('file:')).toBe(false);
  expect(existsSync(resolved)).toBe(true);

  return resolved;
}

describe('load user module', () => {
  describe('extension dispatch', () => {
    it.each([
      ['plain.ts', 'plain-ts'],
      ['plain.mts', 'plain-mts'],
      ['plain.cts', 'plain-cts'],
      ['plain.mjs', 'plain-mjs'],
      ['plain.js', 'plain-js'],
    ])('resolves and loads %s', async (fileName, expected) => {
      const resolved = await resolveOrFail(join(fixtures, fileName));

      expect(basename(resolved)).toBe(fileName);

      const module = await loadUserModule(resolved);

      // The namespace, not the default export — `loadRules` checks `'default' in module`.
      expect('default' in module).toBe(true);
      expect(module.default).toBe(expected);
    });

    it('loads a module whose syntax is not erasable', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'enum.ts'));
      const module = await loadUserModule(resolved);

      // An `enum` emits a runtime object, so this is the case native Node type stripping
      // can never support — it is why the loader carries a real transform.
      expect(module.default).toBe('thyme');
      expect(module.Flavour).toEqual({ Thyme: 'thyme' });
    });

    it('loads a module that imports a sibling through a NodeNext .js specifier', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'split.ts'));
      const module = await loadUserModule(resolved);

      expect(module.default).toBe('split-ts-via-helper');
    });
  });

  describe('resolution', () => {
    it('resolves an extensionless specifier to its .ts file', async () => {
      // `helper`, not `plain`: the `plain.*` fixtures deliberately share a basename to cover
      // extension dispatch, which would make an extensionless `plain` ambiguous.
      const resolved = await resolveOrFail(join(fixtures, 'helper'));

      expect(basename(resolved)).toBe('helper.ts');
    });

    it('resolves a relative NodeNext .js specifier to the .ts file on disk', async () => {
      const resolved = await resolveOrFail('./helper.js');

      expect(basename(resolved)).toBe('helper.ts');
    });

    it('resolves and loads a bare package specifier unchanged', async () => {
      const resolved = await resolveOrFail(BARE_PACKAGE);
      const module = await loadUserModule(resolved);

      expect('default' in module).toBe(true);
    }, 15_000);

    it('declines an explicit declaration-file specifier', async () => {
      // jiti resolves and imports a `.d.ts` successfully, as an empty module. Without the
      // guard the user would see "does not use default export" instead of "cannot resolve".
      await expect(
        resolveUserModule(join(fixtures, 'types.d.ts'), fixtures),
      ).resolves.toBeUndefined();
    });

    it('returns undefined for an unresolvable specifier', async () => {
      await expect(
        resolveUserModule('@thymian/definitely-not-a-real-package', fixtures),
      ).resolves.toBeUndefined();
    });

    it('returns undefined for a Node builtin specifier', async () => {
      // `require.resolve` answers builtins with the bare id (`node:fs`), which is not an
      // absolute path and not a loadable user module.
      await expect(
        resolveUserModule('node:fs', fixtures),
      ).resolves.toBeUndefined();
    });
  });

  describe('preferCwdRelative', () => {
    let decoyCwd = '';

    beforeAll(async () => {
      // A same-named directory in cwd is exactly what hijacks a bare package specifier.
      decoyCwd = await mkdtemp(join(tmpdir(), 'thymian-decoy-cwd-'));
      await mkdir(join(decoyCwd, BARE_PACKAGE), { recursive: true });
    });

    afterAll(async () => {
      await rm(decoyCwd, { recursive: true, force: true });
    });

    it('is hijacked by a same-named directory in cwd when left at its default', async () => {
      await expect(
        resolveUserModule(BARE_PACKAGE, decoyCwd),
      ).resolves.toBeUndefined();
    });

    it('resolves the installed package when preferCwdRelative is false', async () => {
      const resolved = await resolveUserModule(BARE_PACKAGE, decoyCwd, {
        preferCwdRelative: false,
      });

      if (resolved === undefined) {
        throw new Error(
          `Expected "${BARE_PACKAGE}" to resolve from ${decoyCwd}.`,
        );
      }

      expect(isAbsolute(resolved)).toBe(true);
      expect(resolved.startsWith(decoyCwd)).toBe(false);
      expect(resolved).toContain(join('rules-rfc-9110', 'dist'));
    }, 15_000);
  });

  describe('lazy jiti import', () => {
    let jitiFactoryCalls = 0;

    beforeEach(() => {
      jitiFactoryCalls = 0;
      // The jiti instance is memoised in a module-level variable, so the module registry has
      // to be reset around each assertion — a stale memo is the most likely way the
      // "never imported" case passes for the wrong reason.
      vi.resetModules();
      vi.doMock('jiti', async () => {
        jitiFactoryCalls += 1;

        return await vi.importActual<typeof import('jiti')>('jiti');
      });
    });

    afterEach(() => {
      vi.doUnmock('jiti');
      vi.resetModules();
    });

    it('never imports jiti on the JavaScript path', async () => {
      const loader = await import('../src/load-user-module.js');

      for (const specifier of [
        BARE_PACKAGE,
        join(fixtures, 'plain.mjs'),
        join(fixtures, 'plain.js'),
      ]) {
        const resolved = await loader.resolveUserModule(specifier, fixtures);

        if (resolved === undefined) {
          throw new Error(`Expected "${specifier}" to resolve.`);
        }

        await loader.loadUserModule(resolved);
      }

      expect(jitiFactoryCalls).toBe(0);
    }, 15_000);

    it('imports jiti exactly once across two TypeScript loads', async () => {
      const loader = await import('../src/load-user-module.js');

      for (const fileName of ['plain.ts', 'plain.mts']) {
        const resolved = await loader.resolveUserModule(
          join(fixtures, fileName),
          fixtures,
        );

        if (resolved === undefined) {
          throw new Error(`Expected "${fileName}" to resolve.`);
        }

        await loader.loadUserModule(resolved);
      }

      expect(jitiFactoryCalls).toBe(1);
    });
  });
});
