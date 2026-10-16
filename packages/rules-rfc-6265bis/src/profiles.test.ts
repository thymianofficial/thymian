import { deriveMinimalProfile, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6265bis from './index.js';

// Drift guard: every rule id a shipped profile names must be a real rule, and
// `minimal` must be the one derived from the coverage record, never a
// hand-kept list.
describe('rfc-6265bis rule-configuration profiles', () => {
  it('ships recommended, strict and minimal', () => {
    expect(Object.keys(rfc6265bis.profiles ?? {}).sort()).toEqual([
      'minimal',
      'recommended',
      'strict',
    ]);
  });

  it('lists only real rule ids in every profile', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6265bis');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    for (const [profile, config] of Object.entries(rfc6265bis.profiles ?? {})) {
      for (const id of Object.keys(config)) {
        expect(ruleIds.has(id), `${profile} names "${id}"`).toBe(true);
      }
    }
  }, 30_000);

  it('derives minimal from the coverage record', () => {
    expect(rfc6265bis.profiles?.minimal).toEqual(
      deriveMinimalProfile(coverage),
    );
  });

  it('ships an empty strict profile: shipped severities are source fidelity', () => {
    expect(rfc6265bis.profiles?.strict).toEqual({});
  });

  it('ships an empty recommended profile while no convention rule exists', () => {
    expect(rfc6265bis.profiles?.recommended).toEqual({});
  });
});
