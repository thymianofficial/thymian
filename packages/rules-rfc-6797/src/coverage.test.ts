import { checkCoverage, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6797 from './index.js';

// A profile name no real one can match, so `resolveProfileConfig`'s fallback
// — an unknown profile resolves to no overrides — loads every rule at its
// shipped `meta`, which is what the checker's stamp assertion compares
// against. Same trick `scripts/generate-coverage.ts` uses.
const BASELINE_PROFILE_SENTINEL = '__coverage_test_baseline__';

async function loadBaselineRules() {
  return loadRules('@thymian/rules-rfc-6797', undefined, {}, undefined, {
    '@thymian/rules-rfc-6797': BASELINE_PROFILE_SENTINEL,
  });
}

// The gate: the real loader against the real package, the same seam
// `rules-rfc-9110`'s coverage meta-test uses. Unscoped from the first rule
// on, so every rule that lands does so under it.
describe('coverage record', () => {
  it('reports zero violations over the whole package', async () => {
    const rules = await loadBaselineRules();
    const violations = checkCoverage({
      record: coverage,
      rules,
      profiles: rfc6797.profiles,
    });

    expect(violations).toEqual([]);
  }, 30_000);

  // Exact counts, not only "no violations": a checker that skipped every rule
  // would report none too.
  describe('the census', () => {
    it('loads no rules yet, with one entry per loaded rule', async () => {
      const rules = await loadBaselineRules();

      expect(rules.length).toBe(0);
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    // The ids a recount of the pinned text yields under the counting rule:
    // every keyword paragraph of §6, §7 and §9.2, numbered within its section.
    it('declares the 14 units of the pinned revision, keyed <section>/<n>', () => {
      expect(Object.keys(coverage.units)).toEqual([
        '6.1/1',
        '6.1/2',
        '6.1/3',
        '6.1/4',
        '6.1.1/1',
        '6.1.1/2',
        '6.1.2/1',
        '7.1/1',
        '7.1/2',
        '7.1/3',
        '7.2/1',
        '7.2/2',
        '7.2/3',
        '9.2/1',
      ]);
      expect(coverage.source.revision).toBe('RFC 6797 (November 2012)');
      expect(coverage.source.hasKeywordBasis).toBe(true);
      expect(coverage.source.substituteLabel).toBeUndefined();
    });
  });
});
