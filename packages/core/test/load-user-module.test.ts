import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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

    it('treats a symlink and its target as the same module', async () => {
      // Identity, not a counter: `side-effect.ts` is loaded by other tests too. Keyed on the raw
      // string these two spellings are two entries and the body runs once per spelling.
      // (An earlier version of this test used `join(fixtures, 'nested', '..', name)` — which
      // `path.join` normalises at construction, so both paths were already the same string and
      // the test could not fail.)
      const linkDir = await mkdtemp(join(tmpdir(), 'thymian-symlink-'));

      try {
        const link = join(linkDir, 'aliased.ts');

        await symlink(join(fixtures, 'side-effect.ts'), link);

        const viaLink = await loadUserModule(link);
        const direct = await loadUserModule(join(fixtures, 'side-effect.ts'));

        // Compares the exported evaluation counter, not the namespace: jiti hands back a FRESH
        // interop proxy per import even for a cached module, so object identity is not a usable
        // signal. Two identities for one file would give consecutive counter values.
        expect(viaLink.default).toBe(direct.default);
      } finally {
        await rm(linkDir, { recursive: true, force: true });
      }
    });

    it('reports an import cycle instead of hanging', async () => {
      // Undetected this never settles — Node exits 13, "Detected unsettled top-level await".
      //
      // The MESSAGE is asserted, not just the error name. `unloadableReason` throws
      // `UserModuleLoadError` too, so a name-only check also passes for a fixture that merely
      // failed to load — which is how a `new URL(…).pathname` in the fixtures stayed invisible
      // here while turning this into a raw MODULE_NOT_FOUND on all three windows-2022 legs.
      await expect(
        loadUserModule(join(fixtures, 'cycle-a.ts')),
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'UserModuleLoadError',
          message: expect.stringContaining('import cycle'),
        }),
      );
    }, 15_000);

    it('refuses a relative path rather than guessing a base', async () => {
      // The two branches anchored a relative path differently: process.cwd() natively, core's
      // install directory through jiti.
      await expect(loadUserModule('./plain.ts')).rejects.toThrow(
        /absolute path is required/,
      );
    });

    it.skipIf(!CASE_INSENSITIVE_FS)(
      'treats two casings of one path as the same module',
      async () => {
        // Only `resolveUserModule` normalised casing, so a glob- or config-supplied `PLAIN.TS`
        // reaching `loadUserModule` directly matched no dispatch branch and died raw. Asserted
        // as identity because that discriminates under Vitest, where a raw `.TS` import happens
        // to succeed; the plain-Node dispatch failure is covered by the external harness.
        const upper = await loadUserModule(join(fixtures, 'PLAIN.TS'));
        const lower = await loadUserModule(join(fixtures, 'plain.ts'));

        expect(upper.default).toBe(lower.default);
        expect(upper.default).toBe('plain-ts');
      },
    );

    it('pins the export= boundary: primitives wrap, objects do not', async () => {
      // The wrap covers only non-records, so the boundary is narrower than it looks. Documented
      // and pinned rather than left implicit, because the UNWRAPPED side is the natural rule-set
      // shape and a downstream implementer would otherwise meet it as a mystery.
      const wrapped = await loadUserModule(
        await resolveOrFail(join(fixtures, 'primitive.cts')),
      );

      expect('default' in wrapped).toBe(true);

      const unwrapped = await loadUserModule(
        await resolveOrFail(join(fixtures, 'object-export.cts')),
      );

      // Deliberate: through jiti's proxy this shape cannot be told apart from a module with only
      // named exports, so synthesising a default would let a named-only module pass as a rule.
      // Callers therefore report "does not use default export" for it, which is correct.
      expect('default' in unwrapped).toBe(false);
      expect(unwrapped.name).toBe('object-export');
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

  describe('loadUserModule guards', () => {
    // `loadUserModule` is exported alongside `resolveUserModule`, so a caller can reach it with a
    // path the resolver would have declined — a `loadRuleSet` glob or a config `path`. Left
    // unguarded a `.d.ts` imports as an EMPTY module and the caller reports "does not use default
    // export", which is precisely the confusion the resolver's guard prevents.
    it.each([
      ['a declaration file', 'types.d.ts'],
      ['a declaration file spelled with a capital D', 'Legacy.D.ts'],
      ['a .tsx file', 'component.tsx'],
      ['a .jsx file', 'component.jsx'],
      ['a .json file', 'rules.json'],
    ])('refuses %s with a framed error', async (_label, fileName) => {
      await expect(
        loadUserModule(join(fixtures, fileName)),
      ).rejects.toThrowError(
        expect.objectContaining({ name: 'UserModuleLoadError' }),
      );
    });

    it('explains a declaration file rather than returning an empty module', async () => {
      // The regression that matters: this used to RESOLVE to `{}` with no `default`, so the
      // failure surfaced as a misleading complaint about the user's export style.
      await expect(
        loadUserModule(join(fixtures, 'types.d.ts')),
      ).rejects.toThrow(/contains no runtime code/);
    });

    it('still loads a path the resolver accepts', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'plain.ts'));

      await expect(loadUserModule(resolved)).resolves.toMatchObject({
        default: 'plain-ts',
      });
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

    it.each([
      ['a .jsx specifier', 'component.jsx'],
      ['a .json specifier', 'rules.json'],
    ])(
      'declines %s, which no dispatch branch can load',
      async (_label, fileName) => {
        await expect(
          resolveUserModule(join(fixtures, fileName), fixtures),
        ).resolves.toBeUndefined();
      },
    );

    describe('extensionless .mjs and .cjs', () => {
      // Narrowing jiti's `extensions` to TypeScript also narrows what it GUESSES with: jiti
      // derives `additionalExts` from `extensions` by dropping only `.js`, so `.mjs` and `.cjs`
      // leave the guessing list along with the registry. Node's CJS resolver inside
      // `require.resolve` never tried them either (`.js`, `.json`, `.node` only), which left a
      // hole between the two resolvers — measured against jiti 2.6.1: extensionless `./a` with
      // `a.mjs` on disk resolved with the default list and returned `undefined` with the narrowed
      // one. `resolveThroughGuessing` fills it, and these pin both the hole and its ordering.
      let cwd: string;

      beforeAll(async () => {
        cwd = await mkdtemp(join(tmpdir(), 'thymian-guess-'));

        await writeFile(join(cwd, 'only-mjs.mjs'), 'export default "mjs";\n');
        await writeFile(join(cwd, 'only-cjs.cjs'), 'module.exports = "cjs";\n');

        // Precedence fixtures: each basename exists in two spellings at once.
        await writeFile(join(cwd, 'js-and-mjs.js'), 'export default "js";\n');
        await writeFile(join(cwd, 'js-and-mjs.mjs'), 'export default "mjs";\n');
        await writeFile(join(cwd, 'mjs-and-ts.mjs'), 'export default "mjs";\n');
        await writeFile(join(cwd, 'mjs-and-ts.ts'), 'export default "ts";\n');
        await writeFile(
          join(cwd, 'mjs-and-cjs.mjs'),
          'export default "mjs";\n',
        );
        await writeFile(
          join(cwd, 'mjs-and-cjs.cjs'),
          'module.exports = "cjs";\n',
        );

        await mkdir(join(cwd, 'dir-mjs'));
        await writeFile(
          join(cwd, 'dir-mjs', 'index.mjs'),
          'export default "mjs";\n',
        );
        await mkdir(join(cwd, 'dir-cjs'));
        await writeFile(
          join(cwd, 'dir-cjs', 'index.cjs'),
          'module.exports = "cjs";\n',
        );
      });

      afterAll(async () => {
        await rm(cwd, { recursive: true, force: true });
      });

      it.each([
        ['./only-mjs', 'only-mjs.mjs'],
        ['./only-cjs', 'only-cjs.cjs'],
      ])('resolves the extensionless %s to %s', async (specifier, expected) => {
        const resolved = await resolveOrFail(specifier, cwd);

        expect(basename(resolved)).toBe(expected);
      });

      it('resolves an absolute extensionless specifier too, which takes the other branch', async () => {
        // Absolute specifiers are not RELATIVE_SPECIFIER matches, so they travel the bare-name
        // path — the same path every `join(fixtures, …)` test in this file uses.
        const resolved = await resolveOrFail(join(cwd, 'only-mjs'), cwd);

        expect(basename(resolved)).toBe('only-mjs.mjs');
      });

      it.each([
        ['./dir-mjs', 'index.mjs'],
        ['./dir-cjs', 'index.cjs'],
      ])(
        'resolves %s, a directory carrying only %s',
        async (specifier, expected) => {
          const resolved = await resolveOrFail(specifier, cwd);

          expect(basename(resolved)).toBe(expected);
        },
      );

      it('loads what it guessed, so resolution and dispatch agree', async () => {
        const module = await loadUserModule(
          await resolveOrFail('./only-mjs', cwd),
        );

        expect(module.default).toBe('mjs');
      });

      it.each([
        // Guessing runs AFTER `require.resolve`, so a sibling `.js` still wins…
        ['a sibling .js over .mjs', './js-and-mjs', 'js-and-mjs.js'],
        // …and BEFORE the jiti fallback, so `.mjs` still wins over a sibling `.ts`…
        ['.mjs over a sibling .ts', './mjs-and-ts', 'mjs-and-ts.mjs'],
        // …and within the guess itself, `.mjs` precedes `.cjs`.
        ['.mjs over a sibling .cjs', './mjs-and-cjs', 'mjs-and-cjs.mjs'],
      ])(
        'prefers %s, reproducing unnarrowed jiti order',
        async (_label, specifier, expected) => {
          const resolved = await resolveOrFail(specifier, cwd);

          expect(basename(resolved)).toBe(expected);
        },
      );
    });

    it('declines every extension outside the JavaScript/TypeScript allow-list', async () => {
      // `require.resolve` answers with any existing absolute file regardless of extension, so a
      // deny-list left all of these resolving and then dying in the native importer with a raw
      // ERR_UNKNOWN_FILE_EXTENSION. `.node` is here because it is not importable on Node 22 at
      // all (the engines floor); `.wasm` because it needs a flag on Node 20 and exports no
      // default, so it cannot carry a rule.
      const cwd = await mkdtemp(join(tmpdir(), 'thymian-allowlist-'));

      try {
        const declined = [
          'rules.yaml',
          'rules.yml',
          'rules.toml',
          'rules.json5',
          'rules.jsonc',
          'notes.md',
          'notes.txt',
          'addon.node',
          'mod.wasm',
        ];

        for (const name of declined) {
          await writeFile(join(cwd, name), 'stub\n');
        }

        for (const name of declined) {
          await expect(
            resolveUserModule(`./${name}`, cwd),
            `expected ./${name} to be declined`,
          ).resolves.toBeUndefined();
        }

        // The allow-list itself still admits every loadable shape.
        for (const name of ['rule.js', 'rule.mjs', 'rule.cjs']) {
          await writeFile(join(cwd, name), 'export default 1;\n');

          await expect(
            resolveUserModule(`./${name}`, cwd),
            `expected ./${name} to resolve`,
          ).resolves.toBeDefined();
        }
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
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

    it('prefers the user project node_modules over core own for a colliding name', async () => {
      // `graphology` is a real dependency of core, so before the two-anchor cascade the CLI's own
      // copy won and the user's pinned one was unreachable. A package the user named in their
      // config is theirs.
      const userProject = await mkdtemp(
        join(tmpdir(), 'thymian-user-project-'),
      );

      try {
        const pkg = join(userProject, 'node_modules', 'graphology');

        await mkdir(pkg, { recursive: true });
        await writeFile(
          join(pkg, 'package.json'),
          JSON.stringify({
            name: 'graphology',
            main: 'index.js',
            type: 'module',
          }),
        );
        await writeFile(join(pkg, 'index.js'), "export default 'USER-COPY';\n");

        const resolved = await resolveOrFail('graphology', userProject);

        expect(resolved.startsWith(realpathSync.native(userProject))).toBe(
          true,
        );

        const module = await loadUserModule(resolved);

        expect(module.default).toBe('USER-COPY');
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
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

      // A *loadable* decoy directory named after an installed package.
      const decoyPackage = join(decoyCwd, BARE_PACKAGE);

      await mkdir(decoyPackage, { recursive: true });
      await writeFile(
        join(decoyPackage, 'package.json'),
        JSON.stringify({ name: BARE_PACKAGE, main: 'index.js' }),
      );
      await writeFile(
        join(decoyPackage, 'index.js'),
        "export default 'DECOY-DIR';\n",
      );

      // A decoy *file* named after a package core really depends on. Extensionless, so
      // `existsSync` sees it — this is the shape a file-vs-directory gate cannot catch.
      await writeFile(
        join(decoyCwd, 'graphology'),
        "export default 'DECOY-FILE';\n",
      );

      // A local rule *directory* with no installed package of that name: the legitimate case
      // that must keep resolving, because today's `rule-loader` resolves it.
      await mkdir(join(decoyCwd, 'my-rules'), { recursive: true });
      await writeFile(
        join(decoyCwd, 'my-rules', 'index.js'),
        "export default 'local-dir';\n",
      );

      // Same, via `package.json` `main` rather than `index.js`.
      await mkdir(join(decoyCwd, 'pkg-rules'), { recursive: true });
      await writeFile(
        join(decoyCwd, 'pkg-rules', 'package.json'),
        JSON.stringify({ name: 'pkg-rules', main: 'main.js' }),
      );
      await writeFile(
        join(decoyCwd, 'pkg-rules', 'main.js'),
        "export default 'local-main';\n",
      );
    });

    afterAll(async () => {
      await rm(decoyCwd, { recursive: true, force: true });
    });

    it.each([
      ['a directory decoy', BARE_PACKAGE, 'DECOY-DIR'],
      ['an extensionless file decoy', 'graphology', 'DECOY-FILE'],
    ])(
      'does not let %s in cwd shadow an installed package',
      async (_label, specifier, decoyMarker) => {
        // Installed-first ordering is what stops this. A file-vs-directory gate cannot: the
        // file decoy is indistinguishable from a legitimate local module by shape alone.
        const resolved = await resolveOrFail(specifier, decoyCwd);

        expect(resolved.startsWith(decoyCwd)).toBe(false);

        const module = await loadUserModule(resolved);

        expect(module.default).not.toBe(decoyMarker);
      },
      15_000,
    );

    it.each([
      ['a directory holding index.js', 'my-rules', 'local-dir'],
      ['a directory with a package.json main', 'pkg-rules', 'local-main'],
      ['a bare subpath naming a file', 'my-rules/index.js', 'local-dir'],
    ])(
      'falls back to %s when nothing is installed under that name',
      async (_label, specifier, expected) => {
        // `rules: ['my-rules']` resolves through today's `rule-loader`, so the seam must accept
        // it too. An `isFile()` gate on the cwd step broke exactly this.
        const resolved = await resolveOrFail(specifier, decoyCwd);

        expect(resolved.startsWith(decoyCwd)).toBe(true);

        const module = await loadUserModule(resolved);

        expect(module.default).toBe(expected);
      },
    );

    it('skips the cwd fallback entirely when preferCwdRelative is false', async () => {
      // The observable difference the flag makes: with the fallback off, a local-only rule
      // directory is not resolvable at all. Nothing else in the suite distinguishes the flag,
      // so without this test the option can be deleted with the suite still green.
      await expect(
        resolveUserModule('my-rules', decoyCwd, { preferCwdRelative: false }),
      ).resolves.toBeUndefined();

      await expect(
        resolveUserModule('my-rules', decoyCwd, { preferCwdRelative: true }),
      ).resolves.toBeDefined();
    });

    it('resolves an installed package identically with the fallback off', async () => {
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

  describe('jiti configuration', () => {
    afterEach(() => {
      vi.doUnmock('jiti');
      vi.resetModules();
    });

    it('narrows jiti to TypeScript extensions so .js stays with Node', async () => {
      // WHY this asserts the option rather than its consequence: with jiti's default extension
      // list, a `.js` module imported by both a natively-loaded JS rule and a jiti-loaded TS
      // rule lands in two registries and evaluates twice, handing the two rules non-identical
      // objects. That consequence is NOT observable here — Vitest's module runner intercepts
      // `import()`, so jiti's delegation never reaches Node's loader and the two registries stay
      // split regardless of this option. Measured against the BUILT loader under plain Node:
      // 2 evaluations and `===` false with the defaults, 1 and `===` true with this narrowing.
      // The standing external harness asserts the consequence; this asserts the cause, so
      // removing the option still turns a test red.
      vi.resetModules();

      let captured: unknown;

      vi.doMock('jiti', async () => {
        const actual = await vi.importActual<typeof import('jiti')>('jiti');

        return {
          ...actual,
          createJiti: (parentUrl: string, options?: unknown) => {
            captured = options;

            return actual.createJiti(parentUrl, options as never);
          },
        };
      });

      const loader = await import('../src/load-user-module.js');
      const resolved = await loader.resolveUserModule(
        join(fixtures, 'plain.ts'),
        fixtures,
      );

      await loader.loadUserModule(String(resolved));

      expect(captured).toMatchObject({ extensions: ['.ts', '.mts', '.cts'] });
    });
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

      // A bare JS package installed ONLY in the user's project. This is the case that used to
      // miss core's anchor and fall through to the jiti fallback, so a plain-JavaScript rule
      // package paid for jiti — the assertion below passed before only because every other
      // fixture happened to be reachable from core's own tree.
      const userProject = await mkdtemp(join(tmpdir(), 'thymian-user-js-'));

      try {
        const pkg = join(userProject, 'node_modules', 'user-js-rules');

        await mkdir(pkg, { recursive: true });
        await writeFile(
          join(pkg, 'package.json'),
          JSON.stringify({
            name: 'user-js-rules',
            main: 'index.js',
            type: 'module',
          }),
        );
        await writeFile(join(pkg, 'index.js'), "export default 'user-js';\n");

        const resolved = await loader.resolveUserModule(
          'user-js-rules',
          userProject,
        );

        if (resolved === undefined) {
          throw new Error('Expected "user-js-rules" to resolve.');
        }

        await loader.loadUserModule(resolved);
      } finally {
        await rm(userProject, { recursive: true, force: true });
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
