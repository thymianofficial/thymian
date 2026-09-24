import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadRules, type RuleFnResult } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  fixtureContexts,
  type RuleFixtures,
  runInContext,
} from './test/harness.js';

// The fixture bar (ADR-0021 §4): a declared context claims the assertion is
// *demonstrated*, so every executable rule the package ships carries one
// fixture module, with one fixture per context it declares — no more, no
// fewer, and no exemptions. Each fixture then runs through the real engine of
// its context, where it must flag its violating input, pass its conforming
// one — a pass, not a skip — and skip its undecidable one where it has one.

const rulesDir = join(dirname(fileURLToPath(import.meta.url)), 'rules');

const fixtureFiles = readdirSync(rulesDir, {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith('.fixtures.ts'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

const fixtures: RuleFixtures[] = await Promise.all(
  fixtureFiles.map(
    async (file) =>
      ((await import(pathToFileURL(file).href)) as { default: RuleFixtures })
        .default,
  ),
);

const violations = (results: RuleFnResult[]) =>
  results.filter((result) => result.violation !== undefined);

// A skip names the rule it skips, as every `rule-skip` producer does.
const skipsOf = (ruleName: string, results: RuleFnResult[]) =>
  results.filter((result) =>
    result.findings.some(
      (finding) => finding.kind === 'rule-skip' && finding.title === ruleName,
    ),
  );

describe('the fixture bar', () => {
  it('carries exactly one fixture module per executable rule the package ships', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');
    const executable = rules
      .filter((rule) => !rule.meta.type.includes('informational'))
      .map((rule) => rule.meta.name)
      .sort();

    expect(fixtures.map((fixture) => fixture.rule.meta.name).sort()).toEqual(
      executable,
    );
  }, 30_000);

  it('demonstrates exactly the contexts each rule declares', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');
    const declared = new Map(
      rules.map((rule) => [rule.meta.name, [...rule.meta.type].sort()]),
    );

    for (const fixture of fixtures) {
      const demonstrated = fixtureContexts
        .filter((context) => fixture[context] !== undefined)
        .sort();

      expect(demonstrated, fixture.rule.meta.name).toEqual(
        declared.get(fixture.rule.meta.name),
      );
    }
  }, 30_000);
});

describe.each(fixtures)('$rule.meta.name', (fixture) => {
  const declared = fixtureContexts.filter(
    (context) => fixture[context] !== undefined,
  );

  describe.each(declared)('in %s', (context) => {
    const contextFixture = fixture[context];
    if (contextFixture === undefined) {
      return;
    }

    it('flags its violating input', async () => {
      const results = await runInContext(
        context,
        fixture.rule,
        contextFixture.violates,
      );
      expect(violations(results).length).toBeGreaterThan(0);
    });

    it('passes its conforming input', async () => {
      const results = await runInContext(
        context,
        fixture.rule,
        contextFixture.conforms,
      );
      expect(violations(results)).toEqual([]);
      expect(skipsOf(fixture.rule.meta.name, results)).toEqual([]);
    });

    if (contextFixture.skips !== undefined) {
      const undecidable = contextFixture.skips;
      it('skips, rather than passes, the input it cannot decide', async () => {
        const results = await runInContext(context, fixture.rule, undecidable);
        expect(violations(results)).toEqual([]);
        expect(skipsOf(fixture.rule.meta.name, results).length).toBeGreaterThan(
          0,
        );
      });
    }
  });
});
