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
        /Rule or rule set at .*no-default\.rule\.ts does not use default export\./,
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
    // First coverage of `loadRuleSet`'s glob branch at all — both pre-existing rule-set fixtures
    // use an inline `rules` array.
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

      // The 182 built-in rules, loaded as a package, plus a local `.mjs` fixture. This is the
      // "no measurable cold-start regression" criterion, asserted as a fact instead of a
      // wall-clock measurement.
      await freshLoadRules('@thymian/rules-rfc-9110');
      await freshLoadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'a.rule.mjs'),
      );

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
  });
});
