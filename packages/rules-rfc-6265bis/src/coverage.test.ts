import { checkCoverage, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6265bis from './index.js';

// A profile name no real one can match, so `resolveProfileConfig`'s fallback
// — an unknown profile resolves to no overrides — loads every rule at its
// shipped `meta`, which is what the checker's stamp assertion compares
// against. Same trick `scripts/generate-coverage.ts` uses.
const BASELINE_PROFILE_SENTINEL = '__coverage_test_baseline__';

async function loadBaselineRules() {
  return loadRules('@thymian/rules-rfc-6265bis', undefined, {}, undefined, {
    '@thymian/rules-rfc-6265bis': BASELINE_PROFILE_SENTINEL,
  });
}

// The gate: the real loader against the real package, the same seam
// `rules-rfc-6797`'s coverage meta-test uses. Unscoped from the first rule
// on, so every rule that lands does so under it.
describe('coverage record', () => {
  it('reports zero violations over the whole package', async () => {
    const rules = await loadBaselineRules();
    const violations = checkCoverage({
      record: coverage,
      rules,
      profiles: rfc6265bis.profiles,
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
    // the server's keyword paragraphs keyed `<section>/<n>`, the user
    // agent's steps keyed `<section>/step-<k>` by the draft's own number,
    // and the two unnumbered step paragraphs keyed `<section>/<n>`.
    it('declares the 51 units of the pinned revision', () => {
      expect(Object.keys(coverage.units)).toEqual([
        '1/1',
        '3/1',
        '3/2',
        '4.1.1/1',
        '4.1.1/2',
        '4.1.1/3',
        '4.1.1/4',
        '4.1.1/5',
        '4.1.1/6',
        '4.1.1/7',
        '4.1.1/8',
        '4.1.3/1',
        '4.2.1/1',
        '4.2.1/2',
        '4.2.2/1',
        '5.5/1',
        '5.6/1',
        '5.6/step-1',
        '5.6/step-5',
        '5.6/step-6',
        '5.6/step-7',
        '5.6.1/step-2',
        '5.6.1/step-4',
        '5.6.2/step-1',
        '5.6.2/step-2',
        '5.6.2/step-3',
        '5.6.2/step-6',
        '5.6.4/step-1',
        '5.7/step-1',
        '5.7/step-2',
        '5.7/step-3',
        '5.7/step-4',
        '5.7/step-8',
        '5.7/step-9',
        '5.7/step-10',
        '5.7/step-13',
        '5.7/step-16',
        '5.7/step-18',
        '5.7/step-19',
        '5.7/step-20',
        '5.7/step-21',
        '5.7/step-22',
        '6.1/1',
        '6.1/2',
        '7.4/1',
        '8.3/1',
        '8.3/2',
        '8.4/1',
        '8.5/1',
        '8.6/1',
        '8.6/2',
      ]);
      expect(coverage.source.revision).toBe(
        'draft-ietf-httpbis-rfc6265bis-22 (December 2025)',
      );
      expect(coverage.source.hasKeywordBasis).toBe(true);
      expect(coverage.source.substituteLabel).toBeUndefined();
    });

    // Both kinds of unit count in the one N: 24 keyword paragraphs that bind
    // the server, and 27 user-agent steps of §5.5–§5.7 at which a browser
    // ignores or caps what the server sent.
    it('counts 24 server paragraphs and 27 user-agent steps', () => {
      const ids = Object.keys(coverage.units);
      const steps = ids.filter((id) => /^5\.[5-7][./]/.test(id));

      expect(steps.length).toBe(27);
      expect(ids.length - steps.length).toBe(24);
    });
  });
});
