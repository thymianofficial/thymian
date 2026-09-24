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
    it('loads 19 rules, with one entry per loaded rule', async () => {
      const rules = await loadBaselineRules();

      expect(rules.length).toBe(19);
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    it('covers all 14 units', () => {
      const covered = new Set(
        Object.values(coverage.rules).flatMap((entry) => entry.covers),
      );

      expect([...covered].sort()).toEqual(Object.keys(coverage.units).sort());
    });

    it('has 4 informational entries, carrying no cells', () => {
      // Read as a plain string array: the informational and executable
      // branches' tuple types leave `includes` no argument type to accept.
      const informational = Object.values(coverage.rules).filter((entry) =>
        (entry.declared.types as readonly string[]).includes('informational'),
      );

      expect(informational.length).toBe(4);
      for (const entry of informational) {
        expect(entry.contexts).toBeUndefined();
      }
    });

    // Heuristic cells mark the two rules whose requirement no single
    // exchange settles; the one impossible cell is the context an API
    // description cannot express at all.
    it('carries 6 heuristic cells on two rules and 1 impossible cell, in static on the only-one-header rule', () => {
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
        'rfc-6797/hsts-host-should-redirect-insecure-requests-to-https': {
          static: 'heuristic',
          test: 'heuristic',
          analytics: 'heuristic',
        },
        'rfc-6797/hsts-host-must-send-only-one-sts-header': {
          static: {
            verdict: 'impossible',
            reason: 'not-representable',
            note: expect.any(String),
          },
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

  // The recommended profile promotes all four (`profiles.test.ts`), so the
  // zero-violation run above is what proves each carries a tag, is not
  // heuristic, and has an explanation. That the explanation states its reason
  // is left to review: ADR-0021 §3 accepts it cannot be tested mechanically.
  it('ships the four convention rules off, covering no unit', async () => {
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
      'rfc-6797/server-should-redirect-insecure-requests-to-https',
      'rfc-6797/server-should-send-sts-header-over-secure-transport',
      'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year',
      'rfc-6797/server-should-send-sts-preload-directive',
    ]);
    for (const name of conventions) {
      expect(entries[name]?.covers, name).toEqual([]);
    }
  }, 30_000);
});
