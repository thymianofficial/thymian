import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
