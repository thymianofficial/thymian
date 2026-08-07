import { loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import rfc9110 from './index.js';

// Drift/typo guard: every rule id listed in the shipped profiles must resolve
// to a real rule in the package. The analysis doc that seeded the recommended
// map contained an id typo; this test fails loudly if such a drift returns.
describe('rfc9110 rule-configuration profiles', () => {
  it('resolves the package to a non-empty set of rules', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    expect(rules.length).toBeGreaterThan(0);
  }, 30_000);

  it('lists only real rule ids in the recommended profile', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    const recommendedIds = Object.keys(rfc9110.profiles?.recommended ?? {});

    expect(recommendedIds.length).toBe(16);

    for (const id of recommendedIds) {
      expect(ruleIds.has(id), `recommended id "${id}" is not a real rule`).toBe(
        true,
      );
    }
  }, 30_000);

  it('lists only real rule ids in the minimal profile', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    const minimalIds = Object.keys(rfc9110.profiles?.minimal ?? {});

    expect(minimalIds.length).toBeGreaterThan(0);

    for (const id of minimalIds) {
      expect(ruleIds.has(id), `minimal id "${id}" is not a real rule`).toBe(
        true,
      );
    }
  }, 30_000);

  it('ships an empty strict profile', () => {
    expect(rfc9110.profiles?.strict).toEqual({});
  });
});
