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
    it('loads 10 rules, with one entry per loaded rule', async () => {
      const rules = await loadBaselineRules();

      expect(rules.length).toBe(10);
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    // Every unit of §6, and 7.1/1's grammar clause through the rule that
    // discharges 6.1/3.
    it('covers 8 of the 14 units', () => {
      const covered = new Set(
        Object.values(coverage.rules).flatMap((entry) => entry.covers),
      );

      expect([...covered].sort()).toEqual([
        '6.1.1/1',
        '6.1.1/2',
        '6.1.2/1',
        '6.1/1',
        '6.1/2',
        '6.1/3',
        '6.1/4',
        '7.1/1',
      ]);
    });

    it('has 1 informational entry, carrying no cells', () => {
      // Read as a plain string array: the informational and executable
      // branches' tuple types leave `includes` no argument type to accept.
      const informational = Object.values(coverage.rules).filter((entry) =>
        (entry.declared.types as readonly string[]).includes('informational'),
      );

      expect(informational.length).toBe(1);
      expect(informational[0]?.contexts).toBeUndefined();
    });

    // Every rule declares all three contexts, so no cell is impossible; the
    // only cells mark the unrecognized-directive rule heuristic.
    it('carries 3 heuristic cells, all on the unrecognized-directive rule, and no impossible cell', () => {
      const cells = Object.fromEntries(
        Object.entries(coverage.rules).flatMap(([name, entry]) =>
          entry.contexts === undefined ? [] : [[name, entry.contexts]],
        ),
      );

      expect(cells).toEqual({
        'rfc-6797/user-agent-must-ignore-unrecognized-sts-directives': {
          static: 'heuristic',
          test: 'heuristic',
          analytics: 'heuristic',
        },
      });
    });

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

  // The recommended profile promotes both (`profiles.test.ts`), so the
  // zero-violation run above is what proves each carries a tag, is not
  // heuristic, and has an explanation. That the explanation states its reason
  // is left to review: ADR-0021 §3 accepts it cannot be tested mechanically.
  it('ships the two convention rules off, covering no unit', async () => {
    const rules = await loadBaselineRules();
    const conventions = rules
      .filter(
        (rule) =>
          rule.meta.severity === 'off' &&
          !rule.meta.type.includes('informational'),
      )
      .map((rule) => rule.meta.name)
      .sort();
    const entries: Record<string, CoverageEntry> = coverage.rules;

    expect(conventions).toEqual([
      'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year',
      'rfc-6797/server-should-send-sts-preload-directive',
    ]);
    for (const name of conventions) {
      expect(entries[name]?.covers, name).toEqual([]);
    }
  }, 30_000);
});
