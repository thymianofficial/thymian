import { checkCoverage, type CoverageEntry, loadRules } from '@thymian/core';
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
// `rules-rfc-9110`'s coverage meta-test uses.
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
    it('loads all 19 rules, one entry each', async () => {
      const rules = await loadBaselineRules();
      expect(rules.length).toBe(19);
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    it('declares the 14 units of the pinned revision and covers every one', () => {
      const covered = new Set(
        Object.values(coverage.rules).flatMap((entry) => entry.covers),
      );

      expect(Object.keys(coverage.units).length).toBe(14);
      expect([...covered].sort()).toEqual(Object.keys(coverage.units).sort());
      expect(coverage.source.revision).toBe('RFC 6797 (November 2012)');
    });

    it('has 4 informational entries, none carrying cells', () => {
      // Read as a plain string array: the informational and executable
      // branches' tuple types leave `includes` no argument type to accept.
      const informational = Object.values(coverage.rules).filter((entry) =>
        (entry.declared.types as readonly string[]).includes('informational'),
      );

      expect(informational.length).toBe(4);
      expect(informational.every((entry) => entry.contexts === undefined)).toBe(
        true,
      );
    });

    it('carries 6 heuristic cells and 1 impossible cell with a reason and a note', () => {
      const cells = Object.values(coverage.rules).flatMap((entry) =>
        entry.contexts === undefined ? [] : Object.values(entry.contexts),
      );
      const impossible = cells.filter((cell) => typeof cell === 'object');

      expect(cells.filter((cell) => cell === 'heuristic').length).toBe(6);
      expect(impossible.length).toBe(1);
      expect(
        impossible.every(
          (cell) =>
            typeof cell === 'object' &&
            typeof cell.reason === 'string' &&
            cell.note.trim().length > 0,
        ),
      ).toBe(true);
    });
  });

  // `rules-rfc-9110` ships no promotion, so the checker's promotion assertion
  // bites on nothing there. Here it does: the recommended profile turns on all
  // four convention rules, and the zero-violation run above is what proves
  // each carries a tag, is not heuristic, and states its reason.
  it('turns on exactly the four convention rules in recommended, and they cover no unit', async () => {
    const rules = await loadBaselineRules();
    const conventions = rules
      .filter(
        (rule) =>
          rule.meta.severity === 'off' &&
          !rule.meta.type.includes('informational'),
      )
      .map((rule) => rule.meta.name)
      .sort();
    const recommended = rfc6797.profiles?.recommended ?? {};
    const entries: Record<string, CoverageEntry> = coverage.rules;

    expect(conventions).toEqual([
      'rfc-6797/server-should-redirect-insecure-requests-to-https',
      'rfc-6797/server-should-send-sts-header-over-secure-transport',
      'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year',
      'rfc-6797/server-should-send-sts-preload-directive',
    ]);
    for (const name of conventions) {
      expect(recommended[name], name).not.toBe('off');
      expect(entries[name]?.covers, name).toEqual([]);
    }
  }, 30_000);
});
