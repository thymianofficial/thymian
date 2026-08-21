import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadRules } from '../../src/rules/rule-loader.js';
import { ThymianBaseError } from '../../src/thymian.error.js';

// Deliberately a separate file from `load-rules.test.ts`. That file is the JavaScript-path
// regression baseline: every fixture it loads is `.mjs`, and it must keep passing UNMODIFIED,
// because a changed assertion there means the JavaScript path moved. Everything TypeScript lives
// here instead.

const rulesTs = join(import.meta.dirname, 'fixtures', 'rules-ts');
const ruleSetsTs = join(import.meta.dirname, 'fixtures', 'rule-sets-ts');

function ruleNames(rules: Awaited<ReturnType<typeof loadRules>>): string[] {
  return rules.map((rule) => rule.meta.name);
}

function findRule(
  rules: Awaited<ReturnType<typeof loadRules>>,
  name: string,
): Awaited<ReturnType<typeof loadRules>>[number] | undefined {
  return rules.find((rule) => rule.meta.name === name);
}

describe('load rules from TypeScript sources', () => {
  // One test per reproduction the epic recorded as broken. Each is named after the failure it
  // used to produce, so a regression points straight back at the shape that caused it.
  describe('the four failing reproductions', () => {
    it('loads a rule that uses a TypeScript enum (was ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX)', async () => {
      const rules = await loadRules(join(rulesTs, 'enum.rule.ts'));

      expect(ruleNames(rules)).toEqual(['enum-ts']);
      expect(rules[0]?.meta.severity).toBe('error');
    });

    it('loads an extensionless specifier (was RuleLoadError: Cannot resolve rule source)', async () => {
      // The specifier carries no extension and the file on disk is `simple.rule.ts`. Resolution
      // therefore depends on the seam's cwd anchoring plus jiti's extension guessing: the relative
      // specifier becomes `<cwd>/simple.rule` before any resolver sees it, `require.resolve` misses
      // (it tries `.js`/`.json`/`.node`), and jiti finds the `.ts` file.
      const rules = await loadRules('./simple.rule', () => true, {}, rulesTs);

      expect(ruleNames(rules)).toEqual(['simple-ts']);
    });

    it('loads a rule importing "./helper" with no extension (was ERR_MODULE_NOT_FOUND)', async () => {
      const rules = await loadRules(
        join(rulesTs, 'split-extensionless.rule.ts'),
      );

      expect(ruleNames(rules)).toEqual(['split-extensionless']);
      // The type array comes from the imported helper, so a rule that loaded but got an empty
      // namespace back would not survive `assertRuleTypeDeclaration`.
      expect(rules[0]?.meta.type).toEqual(['test', 'analytics']);
    });

    it('loads a rule importing "./helper.js" with only helper.ts on disk (was ERR_MODULE_NOT_FOUND)', async () => {
      const rules = await loadRules(join(rulesTs, 'split-nodenext.rule.ts'));

      expect(ruleNames(rules)).toEqual(['split-nodenext']);
      expect(rules[0]?.meta.type).toEqual(['test', 'analytics']);
    });
  });

  describe('TypeScript extensions', () => {
    it('loads a .ts rule', async () => {
      const rules = await loadRules(join(rulesTs, 'simple.rule.ts'));

      expect(ruleNames(rules)).toEqual(['simple-ts']);
    });

    it('loads a .mts rule', async () => {
      const rules = await loadRules(join(rulesTs, 'mts.rule.mts'));

      expect(ruleNames(rules)).toEqual(['mts-ts']);
    });

    it('loads a .cts rule', async () => {
      const rules = await loadRules(join(rulesTs, 'cts.rule.cts'));

      expect(ruleNames(rules)).toEqual(['cts-ts']);
    });
  });

  describe('error messages', () => {
    it('reports an unresolvable rule source with the specifier the user typed', async () => {
      await expect(
        loadRules('./does-not-exist.rule', () => true, {}, rulesTs),
      ).rejects.toThrow(
        /Cannot resolve rule source \.\/does-not-exist\.rule\./,
      );
    });

    it.each([
      ['rules.yaml', 'only JavaScript and TypeScript modules can be loaded'],
      ['types.d.ts', 'a TypeScript declaration file contains no runtime code'],
    ])(
      'says why %s cannot be loaded instead of calling it unresolvable',
      async (fileName, reason) => {
        // The file is RIGHT THERE. While the seam answered `string | undefined`, this reported
        // `Cannot resolve rule source ./rules.yaml.` — telling the user a file they are looking
        // at cannot be found, because the sentence `unloadableReason` had already produced was
        // discarded at the seam boundary. The specifier stays in the message either way; only
        // the verb and the explanation change.
        const cwd = await mkdtemp(join(tmpdir(), 'thymian-rule-reason-'));

        try {
          await writeFile(join(cwd, fileName), 'stub\n');

          await expect(
            loadRules(`./${fileName}`, () => true, {}, cwd),
          ).rejects.toThrow(
            new RegExp(
              `Cannot load rule source \\./${fileName.replaceAll('.', '\\.')}: ${reason}\\.`,
            ),
          );
        } finally {
          await rm(cwd, { recursive: true, force: true });
        }
      },
    );

    it('reports a missing default export naming the resolved path', async () => {
      await expect(
        loadRules(join(rulesTs, 'no-default.rule.ts')),
      ).rejects.toThrow(
        /Rule or rule set at .*no-default\.rule\.ts does not use default export\./,
      );
    });

    it('names the resolved path even when it differs from the specifier', async () => {
      // The discriminator for the amended message: the specifier is extensionless, so `.rule.ts`
      // can only appear in the message if the RESOLVED path is what is being named. The old
      // locally computed `location` would have printed `…/no-default.rule` here.
      await expect(
        loadRules('./no-default.rule', () => true, {}, rulesTs),
      ).rejects.toThrow(
        /Rule or rule set at \.\/no-default\.rule \(.*no-default\.rule\.ts\) does not use default export\./,
      );
    });

    it('keeps the specifier alongside the resolved path for a cwd-fallback specifier', async () => {
      // AC2 unfreezes TWO shapes and this is the second one: a BARE specifier that resolves through
      // `<cwd>/<specifier>` because nothing is installed under that name. It takes a different
      // branch of the seam than the relative case above, and it is the shape whose old locally
      // computed `location` was capable of naming a file that was never loaded.
      await expect(
        loadRules(
          'rules-ts/no-default.rule.ts',
          () => true,
          {},
          join(import.meta.dirname, 'fixtures'),
        ),
      ).rejects.toThrow(
        /Rule or rule set at rules-ts\/no-default\.rule\.ts \(.*no-default\.rule\.ts\) does not use default export\./,
      );
    });

    it('loads a bare specifier that resolves through the cwd fallback', async () => {
      const rules = await loadRules(
        'rules-ts/simple.rule.ts',
        () => true,
        {},
        join(import.meta.dirname, 'fixtures'),
      );

      expect(ruleNames(rules)).toEqual(['simple-ts']);
    });

    it('names the specifier the user typed alongside the path that was loaded', async () => {
      // Same mechanism as a bare PACKAGE specifier, which is the case that motivated this: a package
      // resolves to a deep `dist/` path nobody typed, and naming only that lost the identity from
      // the user's config. Exercised here with a cwd-fallback specifier because it needs no
      // installed fixture package; `describeRuleSource` does not distinguish the two.
      const error = await loadRules(
        'rules-ts/never-runs.rule.ts',
        () => true,
        {},
        join(import.meta.dirname, 'fixtures'),
      ).then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect((error as Error).message).toMatch(
        /\(loaded from rules-ts\/never-runs\.rule\.ts \(.*never-runs\.rule\.ts\)\)/,
      );
    });

    it('reports an execution-invariant violation for a TypeScript rule, naming the resolved path', async () => {
      // Reaches `assertRuleExecutionInvariant` through the jiti path. Without a TypeScript fixture
      // that actually violates an invariant, the `source` argument those two helpers receive is
      // never observed, and swapping it back would leave the whole suite green.
      await expect(
        loadRules(join(rulesTs, 'never-runs.rule.ts')),
      ).rejects.toThrow(
        /Rule "never-runs-ts" has no execution function for declared type\(s\): static\..*never-runs\.rule\.ts/,
      );
    });

    it('suggests only the export shape that actually works for TypeScript', async () => {
      // `module.exports = …` in a `.ts`/`.cts` file yields a namespace with no `default` key that
      // jiti's interop cannot tell apart from a named-only module, so the seam cannot honour it.
      // Suggesting it would tell the user to do something that provably fails.
      const error = await loadRules(join(rulesTs, 'no-default.rule.ts')).then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(ThymianBaseError);
      expect((error as ThymianBaseError).options.suggestions).toEqual([
        'Use "export default" to export your rule (set), or "module.exports =" in a CommonJS JavaScript file.',
        'A TypeScript source must use "export default" — "module.exports =" there produces a namespace with no default export, indistinguishable from a module with only named exports.',
      ]);
    });
  });

  describe('rule sets authored in TypeScript', () => {
    it('loads a rule set with an inline rules array', async () => {
      const rules = await loadRules(join(ruleSetsTs, 'inline.ruleset.ts'));

      expect(ruleNames(rules)).toEqual(['inline-ts-a', 'inline-ts-b']);
    });

    it('applies a per-rule config override to a TypeScript rule', async () => {
      const rules = await loadRules(
        join(rulesTs, 'simple.rule.ts'),
        () => true,
        { 'simple-ts': 'hint' },
      );

      expect(rules[0]?.meta.severity).toBe('hint');
    });

    it('applies the rule set profile before the user rules config', async () => {
      const ruleSetPath = join(ruleSetsTs, 'with-profiles.ruleset.ts');

      const rules = await loadRules(
        ruleSetPath,
        () => true,
        {},
        process.cwd(),
        { [ruleSetPath]: 'recommended' },
      );

      // recommended demotes profile-ts-a error -> hint and narrows profile-ts-b's type to drop
      // `static`.
      expect(findRule(rules, 'profile-ts-a')?.meta.severity).toBe('hint');
      expect(findRule(rules, 'profile-ts-b')?.meta.type).toEqual([
        'analytics',
        'test',
      ]);
    });

    it('lets the user rules config win over a TypeScript rule set profile', async () => {
      const ruleSetPath = join(ruleSetsTs, 'with-profiles.ruleset.ts');

      const rules = await loadRules(
        ruleSetPath,
        () => true,
        { 'profile-ts-a': 'error' },
        process.cwd(),
        { [ruleSetPath]: 'recommended' },
      );

      expect(findRule(rules, 'profile-ts-a')?.meta.severity).toBe('error');
    });
  });

  describe('rule set pattern globs', () => {
    // First DIRECT coverage of `loadRuleSet`'s glob branch: both pre-existing rule-set fixtures in
    // this package use an inline `rules` array. The branch itself was never uncovered — both shipped
    // rule packages reach their rules through it (`pattern: 'rules/**/*.rule.js'`), exercised
    // cross-package by `packages/rules-rfc-9110/src/profiles.test.ts`. That also means this filter
    // sits on the JavaScript path, which is why `loads every JavaScript match` below exists.
    it('loads every TypeScript match, in deterministic order', async () => {
      const rules = await loadRules(join(ruleSetsTs, 'pattern.ruleset.ts'));

      expect(ruleNames(rules)).toEqual(['globbed-ts-a', 'globbed-ts-b']);
    });

    it('skips a declaration file matched by the glob, without loading it and without throwing', async () => {
      // `./globbed/**/*.ts` matches `types.d.ts` alongside the two rules. `resolveUserModule`
      // declines a `.d.ts` by design, so the filter is what keeps this from failing the whole
      // rule set — and a skipped file is not an error, so nothing is reported either.
      const rules = await loadRules(join(ruleSetsTs, 'pattern-ts.ruleset.ts'));

      expect(ruleNames(rules)).toEqual(['globbed-ts-a', 'globbed-ts-b']);
    });

    it('loads every JavaScript match, the shape both shipped rule packages use', async () => {
      // `pattern: 'rules/**/*.rule.js'` is what `rules-rfc-9110` and
      // `rules-api-description-validation` ship, so this branch carries every built-in rule. A
      // filter accidentally narrowed to TypeScript would drop all of them silently; nothing else in
      // this package would notice.
      const rules = await loadRules(join(ruleSetsTs, 'pattern-js.ruleset.ts'));

      expect(ruleNames(rules)).toEqual(['globbed-js-a', 'globbed-js-b']);
    });

    it('loads every glob of a string[] pattern', async () => {
      // The loop handles an array explicitly and nothing covered it. Mixes a TypeScript glob with a
      // JavaScript one so both dispatch branches run inside one rule set.
      const rules = await loadRules(
        join(ruleSetsTs, 'pattern-array.ruleset.ts'),
      );

      expect(ruleNames(rules)).toEqual([
        'globbed-ts-a',
        'globbed-ts-b',
        'globbed-js-a',
        'globbed-js-b',
      ]);
    });

    it('applies the rule set profile to a globbed rule', async () => {
      // The glob loop forwards `profileConfig` into its recursion. Every other profile fixture uses
      // an inline `rules` array, so this is the only test that proves a profile reaches a rule
      // loaded through the pattern branch.
      const ruleSetPath = join(ruleSetsTs, 'pattern-with-profiles.ruleset.ts');

      const rules = await loadRules(
        ruleSetPath,
        () => true,
        {},
        process.cwd(),
        { [ruleSetPath]: 'recommended' },
      );

      expect(findRule(rules, 'globbed-ts-a')?.meta.severity).toBe('hint');
      expect(findRule(rules, 'globbed-ts-b')?.meta.severity).toBe('error');
    });

    it('lets the user rules config win over a globbed profile override', async () => {
      const ruleSetPath = join(ruleSetsTs, 'pattern-with-profiles.ruleset.ts');

      const rules = await loadRules(
        ruleSetPath,
        () => true,
        { 'globbed-ts-a': 'error' },
        process.cwd(),
        { [ruleSetPath]: 'recommended' },
      );

      expect(findRule(rules, 'globbed-ts-a')?.meta.severity).toBe('error');
    });

    it('throws when a pattern matches files but keeps none of them', async () => {
      // A skipped file is silent by design, but a pattern that kept NOTHING is a mistake every
      // time — a typo'd extension, a directory of declarations. Silent, it returns zero rules and
      // the run passes having validated nothing.
      await expect(
        loadRules(join(ruleSetsTs, 'pattern-none.ruleset.ts')),
      ).rejects.toThrow(
        /Rule set "pattern-none-ts" pattern \.\/nonmodules\/\*\*\/\* matched 2 file\(s\), none of which can be loaded as a rule\./,
      );
    });

    it('does not throw when a rule filter excludes every rule it loaded', async () => {
      // The counterpart to the test above, and why the guard counts FILES rather than rules: a
      // filter legitimately rejecting everything must stay a clean empty result.
      const rules = await loadRules(
        join(ruleSetsTs, 'pattern.ruleset.ts'),
        () => false,
      );

      expect(rules).toEqual([]);
    });

    it('skips every non-module match of a wide-open glob', async () => {
      // `./globbed/**/*` sweeps up `types.d.ts`, `rules.json` and `README.md`. All three plainly
      // exist, so before the filter the whole rule set died with `Cannot resolve rule source`
      // naming a file the user never meant to load.
      const rules = await loadRules(join(ruleSetsTs, 'pattern-all.ruleset.ts'));

      expect(ruleNames(rules)).toEqual(['globbed-ts-a', 'globbed-ts-b']);
    });
  });

  // The filter used to be a local copy of the seam's own allow-list, tested against the raw glob
  // spelling rather than a realpath — so it disagreed with the seam in both directions on a
  // symlink. These pin the fix (#689, #691): the filter now shares `unloadableReason` with the seam
  // and tests it against each match's `realpathSync.native` result, exactly the input shape the
  // seam itself uses.
  describe('symlinked glob matches (realpath-aware filter)', () => {
    const loadableTarget = join(ruleSetsTs, 'globbed', 'a.rule.ts');
    const declarationTarget = join(ruleSetsTs, 'globbed', 'types.d.ts');

    /**
     * Builds a temp rule set whose `pattern` glob reaches into a `rules/` subdirectory of symlinks,
     * per `entries` (name -> absolute realpath target). The rule-set file itself lives OUTSIDE that
     * subdirectory so the pattern can never match it and self-recurse — a separate concern (#688).
     */
    async function loadFromSymlinkedPattern(
      entries: Record<string, string>,
    ): Promise<Awaited<ReturnType<typeof loadRules>>> {
      const dir = await mkdtemp(join(tmpdir(), 'thymian-glob-symlink-'));

      try {
        const rulesDir = join(dir, 'rules');

        await mkdir(rulesDir);

        for (const [name, target] of Object.entries(entries)) {
          await symlink(target, join(rulesDir, name));
        }

        await writeFile(
          join(dir, 'symlinks.ruleset.ts'),
          "export default { name: 'symlinked-ts', pattern: './rules/*.ts' };\n",
        );

        return await loadRules(join(dir, 'symlinks.ruleset.ts'));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }

    it('keeps a .ts symlink to a loadable .ts file', async () => {
      const rules = await loadFromSymlinkedPattern({
        'link.rule.ts': loadableTarget,
      });

      expect(ruleNames(rules)).toEqual(['globbed-ts-a']);
    });

    it("filters out a .ts symlink to a .d.ts file, without throwing (paired with a keeper so it is not the pattern's only match)", async () => {
      const rules = await loadFromSymlinkedPattern({
        'link.rule.ts': loadableTarget,
        'link-to-declaration.rule.ts': declarationTarget,
      });

      expect(ruleNames(rules)).toEqual(['globbed-ts-a']);
    });

    it('keeps a .d.ts symlink to a loadable .ts file (previously dropped silently, the bug this fix corrects)', async () => {
      const rules = await loadFromSymlinkedPattern({
        'link.d.ts': loadableTarget,
      });

      expect(ruleNames(rules)).toEqual(['globbed-ts-a']);
    });

    it('throws "none loadable" when every match is an unloadable symlink (declaration-target only)', async () => {
      // The pre-existing "matched but kept none" throw (see the raw-file case above) must still
      // fire when EVERY match is filtered out via a symlink's realpath, not just a raw declaration
      // file — the realpath-aware filter must not accidentally make this throw unreachable.
      await expect(
        loadFromSymlinkedPattern({
          'link-a.rule.ts': declarationTarget,
          'link-b.rule.ts': declarationTarget,
        }),
      ).rejects.toThrow(
        /Rule set "symlinked-ts" pattern \.\/rules\/\*\.ts matched 2 file\(s\), none of which can be loaded as a rule\./,
      );
    });

    /**
     * Mocks `realpathSync.native` (via `vi.spyOn`, restored with `mockRestore` in `finally`) to
     * throw for exactly one glob match — by path SUFFIX, not equality: `dirname` inside
     * `rule-loader.ts` comes from the ruleset's own already-realpath'd resolved path
     * (`resolveUserModule` normalises it), while `dir` here is the pre-canonicalisation path
     * `mkdtemp` handed back — on macOS those differ by the `/var` -> `/private/var` symlink, so an
     * exact-string match would silently never fire and the test would pass for the wrong reason
     * (nothing filtered, every path resolving through the real implementation regardless).
     */
    async function loadWithFailingRealpath(
      failing: 'ENOENT' | 'EACCES',
    ): Promise<Awaited<ReturnType<typeof loadRules>>> {
      const dir = await mkdtemp(join(tmpdir(), 'thymian-glob-symlink-race-'));
      const original = realpathSync.native;
      const nativeSpy = vi.spyOn(realpathSync, 'native');

      try {
        const rulesDir = join(dir, 'rules');

        await mkdir(rulesDir);
        await symlink(loadableTarget, join(rulesDir, 'keeper.rule.ts'));
        await symlink(loadableTarget, join(rulesDir, 'vanishes.rule.ts'));

        await writeFile(
          join(dir, 'symlinks.ruleset.ts'),
          "export default { name: 'symlinked-ts', pattern: './rules/*.ts' };\n",
        );

        const vanishingSuffix = join('rules', 'vanishes.rule.ts');

        nativeSpy.mockImplementation((...args: Parameters<typeof original>) => {
          const [target] = args;

          if (target.toString().endsWith(vanishingSuffix)) {
            const error = new Error(
              `${failing}: realpath '${String(target)}'`,
            ) as NodeJS.ErrnoException;

            error.code = failing;

            throw error;
          }

          return original(...args);
        });

        return await loadRules(join(dir, 'symlinks.ruleset.ts'));
      } finally {
        nativeSpy.mockRestore();
        await rm(dir, { recursive: true, force: true });
      }
    }

    it('filters out a match whose realpath cannot be resolved (ENOENT), without throwing', async () => {
      // tinyglobby's own crawl already declines a symlink whose target is missing AT GLOB TIME —
      // confirmed empirically, and consistent with `followSymbolicLinks: true` needing a successful
      // stat to admit an entry — so a *dangling-from-the-start* symlink never reaches this filter
      // through the production call. What the filter's `catch` guards against is the narrower race
      // that survives that: the target existing when tinyglobby stats it and being gone by the time
      // this filter re-resolves it moments later (removed, or a flaky mount).
      const rules = await loadWithFailingRealpath('ENOENT');

      expect(ruleNames(rules)).toEqual(['globbed-ts-a']);
    });

    it('filters out a match whose realpath rejects with a non-ENOENT error (EACCES), without throwing', async () => {
      // The filter's `catch` is deliberately error-code-agnostic (a permissions failure or a
      // symlink cycle is treated the same as a dangling target) — this pins that as intentional
      // rather than an artifact of only ever having exercised the ENOENT case.
      const rules = await loadWithFailingRealpath('EACCES');

      expect(ruleNames(rules)).toEqual(['globbed-ts-a']);
    });
  });

  describe('lazy jiti import', () => {
    let jitiFactoryCalls = 0;

    beforeEach(() => {
      jitiFactoryCalls = 0;
      // The seam memoises its jiti instance in a module-level variable, so the module registry has
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

    it('never instantiates jiti for a JavaScript-only load', async () => {
      const { loadRules: freshLoadRules } =
        await import('../../src/rules/rule-loader.js');

      // Every built-in rule, loaded as a package, plus a local `.mjs` fixture. This is the
      // "no measurable cold-start regression" criterion, asserted as a fact instead of a
      // wall-clock measurement.
      const builtIns = await freshLoadRules('@thymian/rules-rfc-9110');
      const local = await freshLoadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'a.rule.mjs'),
      );

      // Assert what loaded, not just that nothing threw. This package reaches its rules through
      // the glob branch this story modified, so a filter narrowed to TypeScript would return an
      // empty array here and the jiti assertion below would still pass.
      expect(builtIns.length).toBeGreaterThan(100);
      expect(ruleNames(local)).toEqual(['a']);

      expect(jitiFactoryCalls).toBe(0);
    }, 15_000);

    it('instantiates jiti exactly once across two TypeScript loads', async () => {
      const { loadRules: freshLoadRules } =
        await import('../../src/rules/rule-loader.js');

      // Deliberately the `enum` fixture. Vitest transforms a dynamic `import()` of a `.ts` file
      // through vite, so the reproduction tests above would keep passing even if this loader were
      // reverted to a native `await import()` — they prove jiti loads the file correctly, not that
      // jiti is what loads it. This assertion is the one that pins the dispatch: an enum fixture
      // that never reaches jiti is a file Node itself cannot execute.
      await freshLoadRules(join(rulesTs, 'enum.rule.ts'));

      expect(jitiFactoryCalls).toBe(1);

      await freshLoadRules(join(rulesTs, 'mts.rule.mts'));

      expect(jitiFactoryCalls).toBe(1);
    });

    it('loads both split-file reproductions through jiti, not through the test runner', async () => {
      // The reproduction tests above cannot prove this on their own: vitest transforms a dynamic
      // `import()` of a `.ts` file, and vite resolves `./helper` and `./helper.js` itself, so both
      // stayed green on the unfixed loader. Asserting that the rule loaded AND that jiti is what
      // loaded it pins the mechanism the reproductions actually depend on — jiti's extension
      // guessing for an import made INSIDE a user module.
      const { loadRules: freshLoadRules } =
        await import('../../src/rules/rule-loader.js');

      const extensionless = await freshLoadRules(
        join(rulesTs, 'split-extensionless.rule.ts'),
      );
      const nodenext = await freshLoadRules(
        join(rulesTs, 'split-nodenext.rule.ts'),
      );

      expect(extensionless.map((rule) => rule.meta.name)).toEqual([
        'split-extensionless',
      ]);
      expect(nodenext.map((rule) => rule.meta.name)).toEqual([
        'split-nodenext',
      ]);
      expect(jitiFactoryCalls).toBe(1);
    });
  });
});

// Regression cover for #688: a rule set reachable from itself through pattern globs used to recurse
// without bound — no output, no error, no exit, until a CI runner timed out. Every case that used to
// hang is wrapped in `settlesWithin`, so a reintroduction fails in seconds with a message naming the
// bug instead of hanging the suite. (A genuine regression leaves the runaway recursion running until
// vitest tears the worker down; that is the cost of proving termination at all.)
describe('rule-set glob recursion (#688)', () => {
  const cycles = join(import.meta.dirname, 'fixtures', 'rule-set-cycles');

  const TIMED_OUT = Symbol('timed-out');

  async function settlesWithin<T>(work: Promise<T>, ms = 5000): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      const outcome = await Promise.race([
        work,
        new Promise<typeof TIMED_OUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMED_OUT), ms);
        }),
      ]);

      if (outcome === TIMED_OUT) {
        throw new Error(
          `loadRules did not settle within ${ms}ms — the #688 rule-set recursion is back.`,
        );
      }

      return outcome;
    } finally {
      clearTimeout(timer);
    }
  }

  // Splits the rendered loop back out of the message so the test can prove it CLOSES, rather than
  // merely asserting some arrow-joined text is present.
  function ringOf(message: string): string[] {
    const rendered = message.split('rule-set cycle ')[1];

    return (rendered ?? '')
      .replace(' can never finish loading.', '')
      .split(' -> ');
  }

  // Checks a ring entry's last two path segments via `node:path`, never a hardcoded `/` regex:
  // the ring holds real canonical filesystem paths, and on Windows those are backslash-separated,
  // so a forward-slash regex silently never matches there — including in a `.some(...) === false`
  // assertion, where a mismatched regex passes for the wrong reason instead of failing.
  function ringEntryIs(
    fullPath: string,
    parentDir: string,
    fileName: string,
  ): boolean {
    return (
      basename(fullPath) === fileName &&
      basename(dirname(fullPath)) === parentDir
    );
  }

  it('loads the siblings of a self-matching rule set, skipping itself', async () => {
    const rules = await settlesWithin(
      loadRules(join(cycles, 'self-with-siblings', 'self.ruleset.ts')),
    );

    expect(ruleNames(rules)).toEqual(['self-sibling-x', 'self-sibling-y']);
  });

  it('returns no rules for a self-matching rule set that is alone in its directory', async () => {
    // The self-match is removed BEFORE story 34.2's match accounting, so this must not surface as
    // `matched 1 file(s), none of which can be loaded as a rule` — the one file it matched loads
    // perfectly well, it is just this rule set itself, and the user could not act on that advice.
    const rules = await settlesWithin(
      loadRules(join(cycles, 'self-alone', 'alone.ruleset.ts')),
    );

    expect(rules).toEqual([]);
  });

  it("still reports a non-module left in a self-matching rule set's glob", async () => {
    // Self-match removal must not swallow 34.2's guard: after this rule set drops itself the glob
    // still holds a `NOTES.md`, and that is still a mistake worth failing on.
    await expect(
      settlesWithin(
        loadRules(join(cycles, 'self-with-nonmodule', 'set.ruleset.ts')),
      ),
    ).rejects.toThrow(
      /matched 1 file\(s\), none of which can be loaded as a rule/,
    );
  });

  it('reports an indirect cycle between two rule sets instead of hanging', async () => {
    const error = await settlesWithin(
      loadRules(join(cycles, 'cycle', 'a.ruleset.ts')),
    ).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ThymianBaseError);
    expect((error as ThymianBaseError).name).toBe('RuleLoadError');
    expect((error as Error).message).toContain('is reachable from itself');

    // Neither file matches ITSELF, so only the ancestry chain can catch this one.
    const ring = ringOf((error as Error).message);

    expect(ring).toHaveLength(3);
    expect(ring[0]).toBe(ring[2]);
    expect(ringEntryIs(ring[0] ?? '', 'cycle', 'a.ruleset.ts')).toBe(true);
    expect(ringEntryIs(ring[1] ?? '', 'cycle', 'b.ruleset.ts')).toBe(true);
  });

  it('excludes an ancestor outside the cycle from the reported ring', async () => {
    // `p` globs `q`, which globs `r`, which globs back to `q` — the loop is `q -> r -> q`, and `p`
    // is only an ancestor. Reporting the whole traversal (`p -> q -> r -> q`) instead of slicing
    // from the actual repeat would misname `p` as being in the cycle.
    const error = await settlesWithin(
      loadRules(join(cycles, 'cycle-with-ancestor', 'p.ruleset.ts')),
    ).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ThymianBaseError);
    expect((error as Error).message).toContain('is reachable from itself');

    const ring = ringOf((error as Error).message);

    expect(ring).toHaveLength(3);
    expect(ring[0]).toBe(ring[2]);
    expect(
      ringEntryIs(ring[0] ?? '', 'cycle-with-ancestor', 'q.ruleset.ts'),
    ).toBe(true);
    expect(
      ringEntryIs(ring[1] ?? '', 'cycle-with-ancestor', 'r.ruleset.ts'),
    ).toBe(true);
    expect(
      ring.some((entry) =>
        ringEntryIs(entry, 'cycle-with-ancestor', 'p.ruleset.ts'),
      ),
    ).toBe(false);
  });

  it('loads a rule reached twice through a diamond without reporting a cycle', async () => {
    // A diamond is not a cycle. This is the case a cumulative visited set would break: the second
    // arm would find the shared rule already seen and silently contribute nothing.
    const rules = await settlesWithin(
      loadRules(join(cycles, 'diamond', 'a.ruleset.ts')),
    );

    expect(ruleNames(rules)).toEqual(['diamond-shared', 'diamond-shared']);
  });

  it('reports a symlinked self-reference instead of hanging', async () => {
    // Path equality cannot see this: the symlink is a different name in the same directory. It
    // falls through to the chain, which resolves both names to one canonical path — so the
    // documented degradation is a clear error, never a hang.
    const dir = await mkdtemp(join(tmpdir(), 'rule-set-symlink-'));

    try {
      await writeFile(
        join(dir, 'real.ruleset.ts'),
        "export default { name: 'symlinked', pattern: './**/*' };\n",
      );
      await symlink(
        join(dir, 'real.ruleset.ts'),
        join(dir, 'alias.ruleset.ts'),
      );

      const error = await settlesWithin(
        loadRules(join(dir, 'real.ruleset.ts')),
      ).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );

      expect(error).toBeInstanceOf(ThymianBaseError);
      expect((error as Error).message).toContain('is reachable from itself');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
