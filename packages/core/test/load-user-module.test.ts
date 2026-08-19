import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
 * True when the filesystem under the fixtures is case-insensitive (default macOS, Windows). The
 * casing-normalisation behaviour can only be observed there — on a case-sensitive volume a
 * mis-cased specifier simply does not exist.
 */
const CASE_INSENSITIVE_FS = existsSync(join(fixtures, 'PLAIN.TS'));

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

    it('wraps a non-object `export =` so the missing-default check cannot throw', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'primitive.cts'));
      const module = await loadUserModule(resolved);

      // Without the wrap this is the bare string, and `'default' in module` throws
      // "Cannot use 'in' operator to search for 'default' in primitive-cts".
      expect(() => 'default' in module).not.toThrow();
      expect('default' in module).toBe(true);
      expect(module.default).toBe('primitive-cts');
    });

    it('evaluates a TypeScript module once across concurrent loads', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'side-effect.ts'));

      // jiti populates its cache only once a load *completes*, so without in-flight
      // de-duplication four concurrent loads evaluate the module four times and hand back
      // four distinct namespaces.
      const modules = await Promise.all(
        [1, 2, 3, 4].map(() => loadUserModule(resolved)),
      );

      expect(modules.map((module) => module.default)).toEqual([1, 1, 1, 1]);
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

    it('declines a declaration file whose extension is not lower-case', async () => {
      // `Legacy.D.ts` is literal on disk, so this holds on case-sensitive volumes too.
      await expect(
        resolveUserModule(join(fixtures, 'Legacy.D.ts'), fixtures),
      ).resolves.toBeUndefined();
    });

    it('declines a .tsx specifier rather than handing it to a transform that cannot parse it', async () => {
      await expect(
        resolveUserModule(join(fixtures, 'component.tsx'), fixtures),
      ).resolves.toBeUndefined();
    });

    it.skipIf(!CASE_INSENSITIVE_FS)(
      'normalises a mis-cased TypeScript specifier to its on-disk casing',
      async () => {
        // Both resolvers echo the caller's spelling, so without normalisation this reaches the
        // dispatch as `.TS`, matches no branch, and dies with ERR_UNKNOWN_FILE_EXTENSION —
        // on two of the three CI platforms but not on ubuntu.
        const resolved = await resolveOrFail(join(fixtures, 'PLAIN.TS'));

        expect(basename(resolved)).toBe('plain.ts');

        const module = await loadUserModule(resolved);

        expect(module.default).toBe('plain-ts');
      },
    );

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

    it('never resolves a relative specifier against core own directory', async () => {
      // `require` is anchored to core's install directory. A relative specifier absent from the
      // user's cwd must come back unresolved, never as one of Thymian's own modules.
      const emptyCwd = await mkdtemp(join(tmpdir(), 'thymian-empty-cwd-'));

      try {
        for (const specifier of [
          './index.js',
          './utils.js',
          './thymian.js',
          '../src/utils.ts',
        ]) {
          await expect(
            resolveUserModule(specifier, emptyCwd),
          ).resolves.toBeUndefined();
        }
      } finally {
        await rm(emptyCwd, { recursive: true, force: true });
      }
    });
  });

  describe('preferCwdRelative', () => {
    let decoyCwd = '';

    beforeAll(async () => {
      // `tmpdir()` is a symlink on macOS (`/var` -> `/private/var`) and resolved paths are
      // realpathed, so the base has to be realpathed too for `startsWith` to mean anything.
      decoyCwd = realpathSync.native(
        await mkdtemp(join(tmpdir(), 'thymian-decoy-cwd-')),
      );

      // A *loadable* decoy: a same-named directory in cwd that resolves as a real package. This
      // is the dangerous shape — left unguarded it runs the decoy's code under the name of the
      // installed package.
      const decoyPackage = join(decoyCwd, BARE_PACKAGE);

      await mkdir(decoyPackage, { recursive: true });
      await writeFile(
        join(decoyPackage, 'package.json'),
        JSON.stringify({ name: BARE_PACKAGE, main: 'index.js' }),
      );
      await writeFile(
        join(decoyPackage, 'index.js'),
        "export default 'DECOY';\n",
      );

      // A bare *subpath* specifier that names a real file in cwd. The cwd preference must still
      // apply here, or `rules: ['my-rules/index.js']` would regress.
      await mkdir(join(decoyCwd, 'my-rules'), { recursive: true });
      await writeFile(
        join(decoyCwd, 'my-rules', 'index.js'),
        "export default 'local-subpath';\n",
      );
    });

    afterAll(async () => {
      await rm(decoyCwd, { recursive: true, force: true });
    });

    it('does not let a loadable same-named directory in cwd shadow an installed package', async () => {
      const resolved = await resolveOrFail(BARE_PACKAGE, decoyCwd);

      expect(resolved.startsWith(decoyCwd)).toBe(false);
      expect(resolved).toContain(join('rules-rfc-9110', 'dist'));

      const module = await loadUserModule(resolved);

      expect(module.default).not.toBe('DECOY');
    }, 15_000);

    it('still prefers a cwd-relative file named by a bare subpath specifier', async () => {
      const resolved = await resolveOrFail('my-rules/index.js', decoyCwd);

      expect(resolved.startsWith(decoyCwd)).toBe(true);

      const module = await loadUserModule(resolved);

      expect(module.default).toBe('local-subpath');
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
      expect(resolved.startsWith('file:')).toBe(false);
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

  describe('when jiti is unavailable or misbehaving', () => {
    afterEach(() => {
      vi.doUnmock('jiti');
      vi.resetModules();
    });

    it('returns undefined instead of throwing, and does not poison later loads', async () => {
      vi.resetModules();
      vi.doMock('jiti', () => {
        throw new Error('simulated broken jiti install');
      });

      const broken = await import('../src/load-user-module.js');

      // Resolution must stay silent: the caller owns the user-facing message, and a raw
      // "simulated broken jiti install" surfacing from a *resolution* attempt would replace it.
      await expect(
        broken.resolveUserModule(join(fixtures, 'helper'), fixtures),
      ).resolves.toBeUndefined();

      // Still undefined, not a cached rejection escaping as a throw.
      await expect(
        broken.resolveUserModule(join(fixtures, 'helper'), fixtures),
      ).resolves.toBeUndefined();

      // A rejected first import must not be memoised: once jiti works, resolution works.
      vi.doUnmock('jiti');
      vi.resetModules();

      const repaired = await import('../src/load-user-module.js');
      const resolved = await repaired.resolveUserModule(
        join(fixtures, 'helper'),
        fixtures,
      );

      expect(resolved).toBeDefined();
      expect(basename(String(resolved))).toBe('helper.ts');
    });

    it.each([
      ['a specifier jiti cannot resolve', undefined],
      ['a non-file URL', 'https://example.test/rule.ts'],
      ['a file URL for a path that does not exist', 'file:///nope/missing.ts'],
    ])(
      'declines %s from the jiti fallback',
      async (_label, esmResolveResult) => {
        vi.resetModules();
        vi.doMock('jiti', () => ({
          createJiti: () => ({
            esmResolve: () => esmResolveResult,
            import: () => {
              throw new Error('should never be reached');
            },
          }),
        }));

        const loader = await import('../src/load-user-module.js');

        // An extensionless specifier misses `existsSync` and `require.resolve`, so it is the
        // shortest route into the jiti fallback where these three guards live.
        await expect(
          loader.resolveUserModule(join(fixtures, 'helper'), fixtures),
        ).resolves.toBeUndefined();
      },
    );
  });
});
