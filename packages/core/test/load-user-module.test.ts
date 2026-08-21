import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';

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

import {
  loadUserModule,
  miscasedExtension,
  resolveUserModule,
  unloadableReason,
} from '../src/load-user-module.js';

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
  const result = await resolveUserModule(specifier, cwd);

  if (!result.ok) {
    throw new Error(
      `Expected "${specifier}" to resolve from ${cwd}` +
        (result.reason === undefined ? '.' : `, but: ${result.reason}.`),
    );
  }

  expect(isAbsolute(result.path)).toBe(true);
  expect(result.path.startsWith('file:')).toBe(false);
  expect(existsSync(result.path)).toBe(true);

  return result.path;
}

/**
 * Asserts a specifier is declined, and hands back the failure so a caller can go on to assert the
 * REASON. Kept separate from `resolveOrFail` because the two halves of the discriminated result
 * are the thing under test: a bare `toBeUndefined()` could not tell "no such file" apart from
 * "exists but unloadable", which is exactly the conflation the result type exists to end.
 */
async function expectDeclined(
  specifier: string,
  cwd: string = fixtures,
  options?: Parameters<typeof resolveUserModule>[2],
): Promise<{ readonly ok: false; readonly reason?: string }> {
  const result = await resolveUserModule(specifier, cwd, options);

  if (result.ok) {
    throw new Error(
      `Expected "${specifier}" to be declined from ${cwd}, got ${result.path}.`,
    );
  }

  return result;
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

    // The concurrent fixtures reach the loader through `globalThis`, not through an import: jiti
    // hands an importing fixture its OWN copy of the seam, and a cycle built across two copies
    // exercises neither one's machinery. See fixtures/user-modules/loader-under-test.ts.
    beforeAll(() => {
      (globalThis as Record<string, unknown>).__thymianLoadUserModule =
        loadUserModule;
    });

    afterAll(() => {
      delete (globalThis as Record<string, unknown>).__thymianLoadUserModule;
    });

    it('reports a cycle formed by two concurrent roots instead of deadlocking', async () => {
      // A DIFFERENT defect from the test above, and invisible to the machinery that catches that
      // one. Each root's evaluation chain holds only its own path, so when root A's top level
      // waits for `b` and root B's waits for `a`, neither chain contains the other's module: the
      // in-flight entry is awaited, the chain is never extended, and the two promises await each
      // other. Reproduced against the built dist before the fix — Node printed "Detected unsettled
      // top-level await" and exited without settling either root.
      //
      // `loadRules` fans out over array input with `Promise.all`, so this is reachable from a
      // user's `rules: [...]`, not just from a fixture.
      const roots = Promise.allSettled([
        loadUserModule(join(fixtures, 'concurrent-cycle-a.ts')),
        loadUserModule(join(fixtures, 'concurrent-cycle-b.ts')),
      ]);

      const settled = await roots;

      // Both roots settle at all — that is the deadlock assertion, and it is why this test asserts
      // on `allSettled` rather than awaiting a rejection.
      expect(settled.map((outcome) => outcome.status)).toEqual([
        'rejected',
        'rejected',
      ]);

      for (const outcome of settled) {
        expect(outcome).toMatchObject({
          reason: expect.objectContaining({
            name: 'UserModuleLoadError',
            // The RING, not just the words "import cycle": the error has to name the loop the user
            // has to break, and a detector that reported the two modules which happened to notice
            // each other would name the wrong pair.
            message: expect.stringMatching(
              /import cycle .*concurrent-cycle-[ab]\.ts -> .*concurrent-cycle-[ab]\.ts -> .*concurrent-cycle-[ab]\.ts/,
            ),
          }),
        });
      }
    }, 20_000);

    it('lets two concurrent roots share a dependency without calling it a cycle', async () => {
      // The false positive that a cruder fix produces. Refusing every cross-root wait, or treating
      // any in-flight entry as a cycle, turns this legitimate shape — two rule files importing one
      // helper, loaded together by `loadRules` — into a spurious cycle error. It also pins that
      // waiting is what makes exactly-once hold: the helper must evaluate ONCE and both roots must
      // receive the same namespace object.
      const [x, y] = await Promise.all([
        loadUserModule(join(fixtures, 'concurrent-dep-x.ts')),
        loadUserModule(join(fixtures, 'concurrent-dep-y.ts')),
      ]);

      expect(x.default).toBe('concurrent-dep-x');
      expect(y.default).toBe('concurrent-dep-y');

      // `===`, not a deep match: two evaluations would produce equal-looking distinct objects.
      expect(x.shared).toBe(y.shared);
      expect(
        (x.shared as { default: { evaluations: number } }).default.evaluations,
      ).toBe(1);
    }, 20_000);

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
      ['a module whose extension is upper-case', 'Upper.Rule.JS'],
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

    it('blames the casing, not the language, for an upper-case extension', async () => {
      // Both loaders were measured to refuse `.JS` outright (`ERR_UNKNOWN_FILE_EXTENSION`), so the
      // refusal is right and only its sentence was wrong (#690).
      await expect(
        loadUserModule(join(fixtures, 'Upper.Rule.JS')),
      ).rejects.toThrow(/extension "\.JS" must be lower-case/);
    });

    it('still loads a path the resolver accepts', async () => {
      const resolved = await resolveOrFail(join(fixtures, 'plain.ts'));

      await expect(loadUserModule(resolved)).resolves.toMatchObject({
        default: 'plain-ts',
      });
    });
  });

  describe('unloadableReason', () => {
    // Exported for `rule-loader.ts`'s glob filter (#689, #691) — pinning its exact return values
    // directly, since external code now depends on them, not just on `resolveUserModule` and
    // `loadUserModule` observing them indirectly.
    it.each([
      ['types.d.ts', 'a TypeScript declaration file contains no runtime code'],
      ['Legacy.D.ts', 'a TypeScript declaration file contains no runtime code'],
      [
        'Upper.Decl.D.TS',
        'a TypeScript declaration file contains no runtime code',
      ],
      ['rules.json', 'only JavaScript and TypeScript modules can be loaded'],
      ['component.tsx', 'only JavaScript and TypeScript modules can be loaded'],
      [
        'Upper.Rule.JS',
        `its extension ".JS" must be lower-case — Node's ESM loader and jiti recognise no other spelling`,
      ],
    ])('reports why %s is unloadable', (fileName, reason) => {
      expect(unloadableReason(join(fixtures, fileName))).toBe(reason);
    });

    it('returns undefined for a loadable path', () => {
      expect(unloadableReason(join(fixtures, 'plain.ts'))).toBeUndefined();
    });

    it('never tells the user a JavaScript module is not a JavaScript module', () => {
      // The #690 regression in one assertion: the old sentence was applied to a file that plainly
      // IS a JavaScript module, so it read as a lie and hid the one-word fix.
      const reason = unloadableReason(join(fixtures, 'Upper.Rule.JS'));

      expect(reason).toContain('.JS');
      expect(reason).not.toContain(
        'only JavaScript and TypeScript modules can be loaded',
      );
    });
  });

  describe('miscasedExtension', () => {
    // Exported so the rule-set glob filter can separate "not a module at all" (silently dropped)
    // from "a module refused only for its casing" (fatal) without parsing a reason sentence.
    it('names the offending extension', () => {
      expect(miscasedExtension(join(fixtures, 'Upper.Rule.JS'))).toBe('.JS');
    });

    it.each([['.JS'], ['.TS'], ['.mjs']])(
      'returns undefined for the stem-less dotfile %s',
      (fileName) => {
        // A bare `.JS` has NO extension — `path.extname` answers `''` — and Node loads it through
        // the package `type` (measured, v26.7.0). Reporting a casing mistake would send the user to
        // rename a working file, and would make the glob filter fatal on it. Asserted on synthetic
        // paths rather than fixtures because `dot: false` keeps dotfiles out of rule-set globs, so
        // no fixture could exercise it.
        expect(miscasedExtension(join(fixtures, fileName))).toBeUndefined();
      },
    );

    it.each([
      ['a loadable lower-case module', 'plain.ts'],
      ['a file that is no module at all', 'rules.json'],
      ['a .tsx file, excluded whatever its casing', 'component.tsx'],
      ['an upper-case declaration file', 'Upper.Decl.D.TS'],
    ])('returns undefined for %s', (_label, fileName) => {
      // The declaration case pins the precedence AS IT STANDS: `DECLARATION_FILE` claims the path
      // first, so the casing branch never sees it and the glob filter drops it silently rather than
      // failing on it. Note this pins the ORDERING, not a verdict on that guard's breadth — it also
      // claims a `Feature.D.TS` whose basename merely ends in `.D`, which is tracked separately.
      expect(miscasedExtension(join(fixtures, fileName))).toBeUndefined();
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
      const declined = await expectDeclined(join(fixtures, 'types.d.ts'));

      expect(declined.reason).toBe(
        'a TypeScript declaration file contains no runtime code',
      );
    });

    it('declines a module whose extension is upper-case, naming the casing', async () => {
      // Reported as `{ ok: false, reason }` so the caller frames it, rather than as a bare
      // "cannot resolve" for a file the user is looking at.
      const declined = await expectDeclined(join(fixtures, 'Upper.Rule.JS'));

      expect(declined.reason).toBe(
        `its extension ".JS" must be lower-case — Node's ESM loader and jiti recognise no other spelling`,
      );
    });

    it('declines a declaration file whose extension is not lower-case', async () => {
      // `Legacy.D.ts` is literal on disk, so this holds on case-sensitive volumes too.
      await expectDeclined(join(fixtures, 'Legacy.D.ts'));
    });

    it('declines a .tsx specifier rather than handing it to a transform that cannot parse it', async () => {
      const declined = await expectDeclined(join(fixtures, 'component.tsx'));

      expect(declined.reason).toBe(
        'only JavaScript and TypeScript modules can be loaded',
      );
    });

    it.each([
      ['a .jsx specifier', 'component.jsx'],
      ['a .json specifier', 'rules.json'],
    ])(
      'declines %s, which no dispatch branch can load',
      async (_label, fileName) => {
        await expectDeclined(join(fixtures, fileName));
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
          const declined = await expectDeclined(`./${name}`, cwd);

          // The REASON, not just the decline: this is the sentence the caller phrases its error
          // with, and returning it is the whole point of the discriminated result.
          expect(
            declined.reason,
            `expected ./${name} to be declined with a reason`,
          ).toBe('only JavaScript and TypeScript modules can be loaded');
        }

        // The allow-list itself still admits every loadable shape.
        for (const name of ['rule.js', 'rule.mjs', 'rule.cjs']) {
          await writeFile(join(cwd, name), 'export default 1;\n');

          await expect(
            resolveUserModule(`./${name}`, cwd),
            `expected ./${name} to resolve`,
          ).resolves.toMatchObject({ ok: true });
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
      const declined = await expectDeclined(
        '@thymian/definitely-not-a-real-package',
      );

      // No reason: nothing is known beyond "not found", and the caller's own
      // "cannot resolve <specifier>" is the right sentence for that.
      expect(declined.reason).toBeUndefined();
    });

    it('returns undefined for a Node builtin specifier', async () => {
      // `require.resolve` answers builtins with the bare id (`node:fs`), which is not an absolute
      // path and not a loadable user module. Still declined after the plain-name `<cwd>` fallback
      // (thymian-internal#687) — but now because `node:fs` is NOT a plain id, so it keeps its
      // non-absolute value and the absolute-path guard refuses it. `node:fs` never reaches
      // `path.resolve`; `builtin-colliding names` below covers the spellings that do.
      await expectDeclined('node:fs');
    });

    describe('builtin-colliding names', () => {
      // `require.resolve` reports a bare-requirable builtin as the bare id, which the resolver
      // chain read as a hit — so the `<cwd>` candidate was unreachable (thymian-internal#687).
      // One helper, one fixture shape: duplicating setup let "same fixture, opposite verdict"
      // pairs drift with nothing to catch it.
      async function withFixture(
        build: (cwd: string) => Promise<void>,
        run: (cwd: string) => Promise<void>,
      ): Promise<void> {
        const cwd = await mkdtemp(join(tmpdir(), 'thymian-builtin-'));

        try {
          await build(cwd);
          await run(cwd);
        } finally {
          // Never let cleanup replace a real assertion failure with an unlink error.
          await rm(cwd, { recursive: true, force: true }).catch(
            () => undefined,
          );
        }
      }

      async function writeModule(dir: string, marker: string): Promise<void> {
        const name = basename(dir);

        await mkdir(dir, { recursive: true });
        await writeFile(
          join(dir, 'package.json'),
          JSON.stringify({ name, main: 'index.js', type: 'module' }),
        );
        await writeFile(join(dir, 'index.js'), `export default '${marker}';\n`);
      }

      it('falls back to a local directory named after a Node builtin', async () => {
        await withFixture(
          (cwd) => writeModule(join(cwd, 'http'), 'LOCAL'),
          async (cwd) => {
            const resolved = await resolveOrFail('http', cwd);

            expect(resolved).toBe(
              join(realpathSync.native(cwd), 'http', 'index.js'),
            );
            expect((await loadUserModule(resolved)).default).toBe('LOCAL');
          },
        );
      });

      it('declines a same-named plain FILE, which is an ordinary helper name', async () => {
        // `util.js`, `os.js`, `path.js` are commonplace at a project root. Running one for
        // `rules: ['util']` would be an accident, so only a DIRECTORY qualifies.
        await withFixture(
          async (cwd) => {
            await writeFile(join(cwd, 'util.js'), "export default 'HELPER';\n");
          },
          async (cwd) => {
            const declined = await expectDeclined('util', cwd);

            // And no `reason`: nothing loadable was named, so this is plain "not found".
            expect(declined.reason).toBeUndefined();
          },
        );
      });

      it('declines when the only local candidate is a non-module', async () => {
        // `<cwd>/http.json` is not a directory, so it is never tried — the user gets "cannot
        // resolve http" rather than a sentence about JSON support for a file they never named.
        await withFixture(
          async (cwd) => {
            await writeFile(join(cwd, 'http.json'), '{"note":"config"}\n');
          },
          async (cwd) => {
            const declined = await expectDeclined('http', cwd);

            expect(declined.reason).toBeUndefined();
          },
        );
      });

      it('still accepts a plain FILE for an ordinary bare name', async () => {
        // Guards against over-fixing: the directory rule applies ONLY to discarded builtin ids.
        await withFixture(
          async (cwd) => {
            await writeFile(
              join(cwd, 'myrules.js'),
              "export default 'PLAIN';\n",
            );
          },
          async (cwd) => {
            const resolved = await resolveOrFail('myrules', cwd);

            expect(resolved).toBe(join(realpathSync.native(cwd), 'myrules.js'));
          },
        );
      });

      it('lets a local directory win over a same-named installed package', async () => {
        // Deliberate, and the one place installed-first bends. The installed copy is created AND
        // asserted reachable by subpath, so this fixture cannot rot into decoration: bare `util`
        // answers local precisely because Node answers the BUILTIN for the bare name, leaving the
        // installed copy unreachable that way.
        await withFixture(
          async (cwd) => {
            await writeModule(join(cwd, 'util'), 'LOCAL');
            await writeModule(join(cwd, 'node_modules', 'util'), 'INSTALLED');
          },
          async (cwd) => {
            const bare = await resolveOrFail('util', cwd);

            expect(bare).toBe(
              join(realpathSync.native(cwd), 'util', 'index.js'),
            );
            expect((await loadUserModule(bare)).default).toBe('LOCAL');

            const subpath = await resolveOrFail('util/index.js', cwd);

            expect(subpath).toBe(
              join(
                realpathSync.native(cwd),
                'node_modules',
                'util',
                'index.js',
              ),
            );
            expect((await loadUserModule(subpath)).default).toBe('INSTALLED');
          },
        );
      });

      it('honours preferCwdRelative for a builtin-colliding name, both ways', async () => {
        // Both flag values against ONE fixture is what makes this discriminating.
        await withFixture(
          (cwd) => writeModule(join(cwd, 'http'), 'LOCAL'),
          async (cwd) => {
            const enabled = await resolveUserModule('http', cwd, {
              preferCwdRelative: true,
            });

            expect(enabled.ok && enabled.path).toBe(
              join(realpathSync.native(cwd), 'http', 'index.js'),
            );

            // Plugins pass `false` and never had a cwd fallback; the fix must not hand them one.
            const declined = await expectDeclined('http', cwd, {
              preferCwdRelative: false,
            });

            expect(declined.reason).toBeUndefined();
          },
        );
      });

      it.each(['fs/promises', 'inspector/promises'])(
        'declines the builtin subpath %s even with a local candidate',
        async (specifier) => {
          // Not a plain id, so not discarded — the absolute-path guard refuses it. Two spellings,
          // because the guard's only other regression test is Windows-skipped below.
          await withFixture(
            async (cwd) => {
              const [dir, file] = specifier.split('/');

              await mkdir(join(cwd, dir), { recursive: true });
              await writeFile(
                join(cwd, dir, `${file}.mjs`),
                "export default 'LOCAL-SUBPATH';\n",
              );
            },
            async (cwd) => {
              const declined = await expectDeclined(specifier, cwd);

              expect(declined.reason).toBeUndefined();
            },
          );
        },
      );

      it('declines a node:-prefixed specifier even with a local candidate', async () => {
        // `node:fs` is the explicit builtin spelling and never reaches `path.resolve`.
        await withFixture(
          async (cwd) => {
            // A ':' is illegal in a Windows path component, so the candidate is unconstructible
            // there — which is itself why the specifier can never resolve on Windows. The
            // assertion below still runs on every platform.
            if (process.platform !== 'win32') {
              await writeModule(join(cwd, 'node:fs'), 'LOCAL-NODE-FS');
            }
          },
          async (cwd) => {
            await expectDeclined('node:fs', cwd);
          },
        );
      });

      it('declines a plain builtin name with nothing local at all', async () => {
        // Isolated cwd on purpose: against the shared fixture root this would silently flip the
        // day someone adds an `fs.*` fixture for an unrelated test.
        await withFixture(
          async () => undefined,
          async (cwd) => {
            const declined = await expectDeclined('fs', cwd);

            expect(declined.reason).toBeUndefined();
          },
        );
      });
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
          await expectDeclined(specifier, emptyCwd);
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

      // Local TypeScript, in the three spellings a bare specifier can name it: extensionless
      // file, directory with a TypeScript index, and the NodeNext `.js` spelling of a `.ts`
      // file. None of these is an installed package, and none of them existed under the exact
      // spelling the fallback used to gate on.
      await writeFile(
        join(decoyCwd, 'ts-rule.ts'),
        "const rule: string = 'local-ts-file';\nexport default rule;\n",
      );

      await mkdir(join(decoyCwd, 'ts-dir'), { recursive: true });
      await writeFile(
        join(decoyCwd, 'ts-dir', 'index.ts'),
        "const rule: string = 'local-ts-dir';\nexport default rule;\n",
      );

      await writeFile(
        join(decoyCwd, 'nodenext-rule.ts'),
        "const rule: string = 'local-ts-nodenext';\nexport default rule;\n",
      );

      // A bare SUBPATH collision: the same `<pkg>/rules` path exists both installed and in cwd,
      // and only jiti can resolve either — `require.resolve` refuses a `.ts` subpath. This is
      // what pins the jiti step to the INSTALLED candidate rather than the cwd one.
      const installedSubpath = join(decoyCwd, 'node_modules', 'subpath-rules');

      await mkdir(installedSubpath, { recursive: true });
      await writeFile(
        join(installedSubpath, 'package.json'),
        JSON.stringify({ name: 'subpath-rules', type: 'module' }),
      );
      await writeFile(
        join(installedSubpath, 'rules.ts'),
        "const rule: string = 'INSTALLED-SUBPATH';\nexport default rule;\n",
      );

      await mkdir(join(decoyCwd, 'subpath-rules'), { recursive: true });
      await writeFile(
        join(decoyCwd, 'subpath-rules', 'rules.ts'),
        "const rule: string = 'DECOY-SUBPATH';\nexport default rule;\n",
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

    it.each([
      ['an extensionless local .ts file', 'ts-rule', 'local-ts-file'],
      ['a local directory with a TypeScript index', 'ts-dir', 'local-ts-dir'],
      [
        'the NodeNext .js spelling of a local .ts file',
        'nodenext-rule.js',
        'local-ts-nodenext',
      ],
    ])(
      'falls back to %s named by a BARE specifier',
      async (_label, specifier, expected) => {
        // The headline case for this seam, and the shape `rule-loader` accepts today, yet none
        // of these resolved: the fallback gated on `existsSync(<cwd>/<specifier>)` — the
        // EXTENSIONLESS spelling, which is not what is on disk — and the jiti step it fell
        // through to was handed the BARE name, which searches `node_modules` only. Measured:
        // bare `ts-rule` came back `undefined` from jiti while `<cwd>/ts-rule` came back
        // `ts-rule.ts`. The identical file resolved fine spelled `./ts-rule`.
        const resolved = await resolveOrFail(specifier, decoyCwd);

        expect(resolved.startsWith(decoyCwd)).toBe(true);

        const module = await loadUserModule(resolved);

        expect(module.default).toBe(expected);
      },
    );

    it.each([
      ['a bare TypeScript subpath', 'subpath-rules/rules'],
      ['its NodeNext .js spelling', 'subpath-rules/rules.js'],
    ])(
      'resolves %s to the installed package, not the same path in cwd',
      async (_label, specifier) => {
        // Both candidates exist and only jiti can resolve either, so this is decided purely by
        // WHICH candidate the jiti step is given first. Running it on the cwd path before the
        // bare one — the shape the fix could easily have taken — resolves the decoy instead and
        // turns this red, which is the whole reason installed-first is ordered by candidate
        // rather than by resolver.
        const resolved = await resolveOrFail(specifier, decoyCwd);

        expect(resolved).toContain(join('node_modules', 'subpath-rules'));

        const module = await loadUserModule(resolved);

        expect(module.default).toBe('INSTALLED-SUBPATH');
      },
    );

    it('skips the cwd fallback entirely when preferCwdRelative is false', async () => {
      // The observable difference the flag makes: with the fallback off, a local-only rule
      // directory is not resolvable at all. Nothing else in the suite distinguishes the flag,
      // so without this test the option can be deleted with the suite still green.
      await expectDeclined('my-rules', decoyCwd, { preferCwdRelative: false });

      await expect(
        resolveUserModule('my-rules', decoyCwd, { preferCwdRelative: true }),
      ).resolves.toMatchObject({ ok: true });
    });

    it('resolves an installed package identically with the fallback off', async () => {
      const result = await resolveUserModule(BARE_PACKAGE, decoyCwd, {
        preferCwdRelative: false,
      });

      if (!result.ok) {
        throw new Error(
          `Expected "${BARE_PACKAGE}" to resolve from ${decoyCwd}.`,
        );
      }

      expect(isAbsolute(result.path)).toBe(true);
      expect(result.path.startsWith('file:')).toBe(false);
      expect(result.path.startsWith(decoyCwd)).toBe(false);
      expect(result.path).toContain(join('rules-rfc-9110', 'dist'));
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
      const result = await loader.resolveUserModule(
        join(fixtures, 'plain.ts'),
        fixtures,
      );

      if (!result.ok) {
        throw new Error('Expected the TypeScript fixture to resolve.');
      }

      await loader.loadUserModule(result.path);

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
        const result = await loader.resolveUserModule(specifier, fixtures);

        if (!result.ok) {
          throw new Error(`Expected "${specifier}" to resolve.`);
        }

        await loader.loadUserModule(result.path);
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

        const result = await loader.resolveUserModule(
          'user-js-rules',
          userProject,
        );

        if (!result.ok) {
          throw new Error('Expected "user-js-rules" to resolve.');
        }

        await loader.loadUserModule(result.path);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }

      expect(jitiFactoryCalls).toBe(0);
    }, 15_000);

    it('keeps require.resolve working for a relative cwd across a chdir', async () => {
      // The require anchor is memoised per directory, and a RELATIVE `cwd` names a different
      // directory before and after a `chdir`. Keyed by the raw string, the second call got the
      // first call's anchor: `require.resolve` missed a package that was plainly installed and
      // resolution fell through to the jiti fallback — a plain-JavaScript package paying for jiti,
      // which contract item 4 forbids. Measured with `JITI_DEBUG=1` before the fix.
      //
      // Asserted through the jiti counter rather than the returned path, because the path came back
      // CORRECT either way: jiti found what the stale anchor had missed. Only the cost differed,
      // which is exactly the kind of regression a result assertion cannot see.
      const loader = await import('../src/load-user-module.js');
      const original = process.cwd();
      const root = await mkdtemp(join(tmpdir(), 'thymian-relative-cwd-'));

      try {
        for (const name of ['first', 'second']) {
          const pkg = join(root, name, 'node_modules', `${name}-rules`);

          await mkdir(pkg, { recursive: true });
          await writeFile(
            join(pkg, 'package.json'),
            JSON.stringify({
              name: `${name}-rules`,
              main: 'index.js',
              type: 'module',
            }),
          );
          await writeFile(join(pkg, 'index.js'), `export default '${name}';\n`);
        }

        process.chdir(join(root, 'first'));

        await expect(
          loader.resolveUserModule('first-rules', '.'),
        ).resolves.toMatchObject({ ok: true });

        // Same relative spelling, different directory.
        process.chdir(join(root, 'second'));

        await expect(
          loader.resolveUserModule('second-rules', '.'),
        ).resolves.toMatchObject({ ok: true });

        expect(jitiFactoryCalls).toBe(0);
      } finally {
        process.chdir(original);
        await rm(root, { recursive: true, force: true });
      }
    }, 15_000);

    it('imports jiti exactly once across two TypeScript loads', async () => {
      const loader = await import('../src/load-user-module.js');

      for (const fileName of ['plain.ts', 'plain.mts']) {
        const result = await loader.resolveUserModule(
          join(fixtures, fileName),
          fixtures,
        );

        if (!result.ok) {
          throw new Error(`Expected "${fileName}" to resolve.`);
        }

        await loader.loadUserModule(result.path);
      }

      expect(jitiFactoryCalls).toBe(1);
    });
  });

  describe('resolveThroughExportsMap (conditions-aware bare-specifier resolution)', () => {
    // Mirrors the "lazy jiti import" describe block's own pattern, independently: these tests
    // assert on jiti's ABSENCE (an ESM-only package must never need it) or on `resolve.exports`'s
    // presence/absence (proving whether the new step ran at all), so each needs its own fresh
    // module registry. Every test below resolves through a freshly `import()`ed `loader`, never
    // through this file's static top-level `resolveUserModule`/`loadUserModule` bindings — those
    // were captured before any mock existed and would silently bypass both mocks, the same
    // false-pass-for-the-wrong-reason trap the "lazy jiti import" block's own comments warn about.
    let jitiFactoryCalls = 0;
    let exportsMapCalls = 0;

    beforeEach(() => {
      jitiFactoryCalls = 0;
      exportsMapCalls = 0;
      vi.resetModules();
      vi.doMock('jiti', async () => {
        jitiFactoryCalls += 1;

        return await vi.importActual<typeof import('jiti')>('jiti');
      });
      vi.doMock('resolve.exports', async () => {
        const actual =
          await vi.importActual<typeof import('resolve.exports')>(
            'resolve.exports',
          );

        return {
          ...actual,
          exports: (...args: Parameters<typeof actual.exports>) => {
            exportsMapCalls += 1;

            return actual.exports(...args);
          },
        };
      });
    });

    afterEach(() => {
      vi.doUnmock('jiti');
      vi.doUnmock('resolve.exports');
      vi.resetModules();
    });

    /** Writes a minimal package to `dir/node_modules/name`, returning the package directory. */
    async function writePackage(
      dir: string,
      name: string,
      packageJson: Record<string, unknown>,
      files: Record<string, string>,
    ): Promise<string> {
      const pkgDir = join(dir, 'node_modules', name);

      await mkdir(pkgDir, { recursive: true });
      await writeFile(
        join(pkgDir, 'package.json'),
        JSON.stringify({ name, ...packageJson }),
      );

      for (const [fileName, contents] of Object.entries(files)) {
        const filePath = join(pkgDir, fileName);

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, contents);
      }

      return pkgDir;
    }

    it('resolves an ESM-only package without ever importing jiti', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(join(tmpdir(), 'thymian-esm-only-'));

      try {
        await writePackage(
          userProject,
          'esm-only-pkg',
          { type: 'module', exports: { '.': { import: './index.mjs' } } },
          { 'index.mjs': "export default 'esm-only';\n" },
        );

        const result = await loader.resolveUserModule(
          'esm-only-pkg',
          userProject,
        );

        if (!result.ok) {
          throw new Error('Expected "esm-only-pkg" to resolve.');
        }

        const module = await loader.loadUserModule(result.path);

        expect(module.default).toBe('esm-only');
        expect(jitiFactoryCalls).toBe(0);
        expect(exportsMapCalls).toBeGreaterThan(0);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);

    it('resolves a subpath through the exports map', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(join(tmpdir(), 'thymian-esm-subpath-'));

      try {
        await writePackage(
          userProject,
          'esm-subpath-pkg',
          {
            type: 'module',
            exports: { './utils': { import: './dist/utils.mjs' } },
          },
          { 'dist/utils.mjs': "export default 'esm-subpath-utils';\n" },
        );

        const result = await loader.resolveUserModule(
          'esm-subpath-pkg/utils',
          userProject,
        );

        if (!result.ok) {
          throw new Error('Expected "esm-subpath-pkg/utils" to resolve.');
        }

        const module = await loader.loadUserModule(result.path);

        expect(module.default).toBe('esm-subpath-utils');
        expect(jitiFactoryCalls).toBe(0);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);

    it('resolves a scoped package with a subpath', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(join(tmpdir(), 'thymian-esm-scoped-'));

      try {
        await writePackage(
          userProject,
          '@thymian-test/esm-scoped-pkg',
          {
            type: 'module',
            exports: { './rules': { import: './rules.mjs' } },
          },
          { 'rules.mjs': "export default 'esm-scoped-rules';\n" },
        );

        const result = await loader.resolveUserModule(
          '@thymian-test/esm-scoped-pkg/rules',
          userProject,
        );

        if (!result.ok) {
          throw new Error(
            'Expected "@thymian-test/esm-scoped-pkg/rules" to resolve.',
          );
        }

        const module = await loader.loadUserModule(result.path);

        expect(module.default).toBe('esm-scoped-rules');
        expect(jitiFactoryCalls).toBe(0);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);

    it('leaves a dual-published package on its existing CJS-conditioned path, untouched', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(
        join(tmpdir(), 'thymian-dual-published-'),
      );

      try {
        await writePackage(
          userProject,
          'dual-published-pkg',
          {
            type: 'commonjs',
            exports: {
              '.': { import: './index.mjs', require: './index.cjs' },
            },
          },
          {
            'index.mjs': "export default 'dual-esm';\n",
            'index.cjs': "module.exports = { default: 'dual-cjs' };\n",
          },
        );

        const result = await loader.resolveUserModule(
          'dual-published-pkg',
          userProject,
        );

        if (!result.ok) {
          throw new Error('Expected "dual-published-pkg" to resolve.');
        }

        // require.resolve applies the CJS condition set and answers the `.cjs` half — preserved
        // behaviour this story does not change (see the story's Dev Notes and AC5).
        expect(result.path.endsWith('index.cjs')).toBe(true);
        expect(exportsMapCalls).toBe(0);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);

    it("prefers the user project's copy over one installed in core's own directory", async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(
        join(tmpdir(), 'thymian-esm-precedence-'),
      );
      // A real directory `require.resolve.paths` walks from `load-user-module.ts`'s own
      // location — the only way to exercise the "core" anchor honestly, matching how
      // `BARE_PACKAGE` (an actual workspace dependency) is used elsewhere in this file for the
      // same reason. Removed in `finally` regardless of outcome.
      const coreAnchorDir = join(import.meta.dirname, '..');
      const packageName = 'thymian-test-core-anchor-precedence-esm';

      try {
        await writePackage(
          coreAnchorDir,
          packageName,
          { type: 'module', exports: { '.': { import: './index.mjs' } } },
          { 'index.mjs': "export default 'from-core';\n" },
        );
        await writePackage(
          userProject,
          packageName,
          { type: 'module', exports: { '.': { import: './index.mjs' } } },
          { 'index.mjs': "export default 'from-user';\n" },
        );

        const result = await loader.resolveUserModule(packageName, userProject);

        if (!result.ok) {
          throw new Error(`Expected "${packageName}" to resolve.`);
        }

        expect(result.path.startsWith(realpathSync.native(userProject))).toBe(
          true,
        );

        const module = await loader.loadUserModule(result.path);

        expect(module.default).toBe('from-user');
      } finally {
        await rm(userProject, { recursive: true, force: true });
        await rm(join(coreAnchorDir, 'node_modules', packageName), {
          recursive: true,
          force: true,
        });
      }
    }, 15_000);

    it('tries every candidate in an exports fallback array, in order', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(
        join(tmpdir(), 'thymian-esm-fallback-'),
      );

      try {
        await writePackage(
          userProject,
          'esm-fallback-pkg',
          {
            type: 'module',
            // './missing.mjs' is never written to disk — the first candidate must be tried and
            // skipped, not assumed to be the only one.
            exports: { '.': { import: ['./missing.mjs', './index.mjs'] } },
          },
          { 'index.mjs': "export default 'esm-fallback';\n" },
        );

        const result = await loader.resolveUserModule(
          'esm-fallback-pkg',
          userProject,
        );

        if (!result.ok) {
          throw new Error('Expected "esm-fallback-pkg" to resolve.');
        }

        const module = await loader.loadUserModule(result.path);

        expect(module.default).toBe('esm-fallback');
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);

    it('falls through to jiti, unresolved, for an exports map with no matching condition', async () => {
      const loader = await import('../src/load-user-module.js');
      const userProject = await mkdtemp(
        join(tmpdir(), 'thymian-esm-no-match-'),
      );

      try {
        await writePackage(
          userProject,
          'browser-only-pkg',
          {
            type: 'module',
            // Neither `import`, `require` nor `default` — require.resolve AND
            // resolveThroughExportsMap both miss, so this proves the miss is silent rather than
            // a thrown error, and that resolution still reaches (and exhausts) jiti's fallback.
            exports: { '.': { browser: './index.browser.mjs' } },
          },
          { 'index.browser.mjs': "export default 'browser-only';\n" },
        );

        const result = await loader.resolveUserModule(
          'browser-only-pkg',
          userProject,
        );

        expect(result.ok).toBe(false);
        expect(jitiFactoryCalls).toBe(1);
      } finally {
        await rm(userProject, { recursive: true, force: true });
      }
    }, 15_000);
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
      ).resolves.toEqual({ ok: false });

      // Still a plain decline, not a cached rejection escaping as a throw.
      await expect(
        broken.resolveUserModule(join(fixtures, 'helper'), fixtures),
      ).resolves.toEqual({ ok: false });

      // A rejected first import must not be memoised: once jiti works, resolution works.
      vi.doUnmock('jiti');
      vi.resetModules();

      const repaired = await import('../src/load-user-module.js');
      const result = await repaired.resolveUserModule(
        join(fixtures, 'helper'),
        fixtures,
      );

      expect(result.ok).toBe(true);
      expect(basename(result.ok ? result.path : '')).toBe('helper.ts');
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
        ).resolves.toEqual({ ok: false });
      },
    );
  });
});
