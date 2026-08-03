import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadRules } from '../../src/rules/rule-loader.js';

describe('load rules', () => {
  it('should load rules from package', async () => {
    await loadRules('@thymian/rules-rfc-9110');
  }, 15_000);

  it('overrides severity from config with object', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: {
          severity: 'off',
        },
        b: {
          severity: 'hint',
        },
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'off', name: 'a' }),
        }),
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'hint', name: 'b' }),
        }),
      ]),
    );
  });

  it('overrides severity from config with string', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: 'off',
        b: 'hint',
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'off', name: 'a' }),
        }),
        expect.objectContaining({
          meta: expect.objectContaining({ severity: 'hint', name: 'b' }),
        }),
      ]),
    );
  });

  it('overrides type from config', async () => {
    const basePath = import.meta.dirname;

    const rules = await loadRules(
      ['a', 'b'].map((name) =>
        join(basePath, 'fixtures', 'rules', `${name}.rule.mjs`),
      ),
      () => true,
      {
        a: {
          type: ['analytics'],
        },
      },
    );

    expect(rules).toHaveLength(2);

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({ type: ['analytics'], name: 'a' }),
        }),
      ]),
    );
  });

  it('rejects a rule that declares an executable type without an execution function', async () => {
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'never-runs.rule.mjs'),
      ),
    ).rejects.toThrow(/no execution function for declared type\(s\): static/);
  });

  it('rejects a rule set containing an inline rule without an execution function', async () => {
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rule-sets', 'inline-broken.mjs'),
      ),
    ).rejects.toThrow(/no execution function for declared type\(s\): test/);
  });

  it('rejects a config type override pointing at a type without an execution function', async () => {
    // Fixture b only defines a test execution function, so running it as
    // 'static' could never execute anything.
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'b.rule.mjs'),
        () => true,
        {
          b: {
            type: ['static'],
          },
        },
      ),
    ).rejects.toThrow(/no execution function for declared type\(s\): static/);
  });

  it('does not validate a rule that the rule filter excludes', async () => {
    // Disabling a broken rule must unblock the load: the execution invariant
    // is only asserted on rules that pass the rule filter.
    const rules = await loadRules(
      join(import.meta.dirname, 'fixtures', 'rules', 'never-runs.rule.mjs'),
      (rule) => rule.meta.severity !== 'off',
      {
        'never-runs': 'off',
      },
    );

    expect(rules).toEqual([]);
  });

  it('applies config overrides to inline rule-set rules before validating', async () => {
    // The informational downgrade escape hatch must also work for rules
    // shipped inline in a rule set.
    const rules = await loadRules(
      join(import.meta.dirname, 'fixtures', 'rule-sets', 'inline-broken.mjs'),
      () => true,
      {
        'inline-never-runs': {
          severity: 'hint',
          type: ['informational'],
        },
      },
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.meta.type).toEqual(['informational']);
    expect(rules[0]?.meta.severity).toBe('hint');
  });

  it('rejects a rule without a type declaration with a curated error', async () => {
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'no-type.rule.mjs'),
      ),
    ).rejects.toThrow(/does not declare valid rule types/);
  });

  it('rejects a rule with an empty type array', async () => {
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'empty-type.rule.mjs'),
      ),
    ).rejects.toThrow(/does not declare valid rule types/);
  });

  it('rejects a malformed type declaration even when the rule filter would exclude it', async () => {
    // Rule filters dereference meta.type, so shape validation runs first.
    await expect(
      loadRules(
        join(import.meta.dirname, 'fixtures', 'rules', 'no-type.rule.mjs'),
        () => false,
      ),
    ).rejects.toThrow(/does not declare valid rule types/);
  });

  it('allows a config type override downgrading a rule to informational', async () => {
    const rules = await loadRules(
      join(import.meta.dirname, 'fixtures', 'rules', 'b.rule.mjs'),
      () => true,
      {
        b: {
          type: ['informational'],
        },
      },
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.meta.type).toEqual(['informational']);
  });
});
