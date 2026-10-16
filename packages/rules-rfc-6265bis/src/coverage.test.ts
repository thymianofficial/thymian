import {
  checkCoverage,
  type CoverageEntry,
  type CoverageViolation,
  loadRules,
  type Rule,
} from '@thymian/core';
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
    it('loads 36 rules, with one entry per loaded rule', async () => {
      const rules = await loadBaselineRules();

      expect(rules.length).toBe(36);
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    // The verdict table's `syntax` rows: G1, the grammar rule, covers every
    // unit whose trigger is a line §4.1.1's grammar rejects, and one rule
    // each covers the other seven units of §3 and §4.1.1. Its
    // `cookie-header` rows: the large-cookies rule covers the two units on
    // the size and number of cookies, and one informational rule each the
    // other three. Its `set-cookie-processing` rows: one rule each covers
    // the lifetime cap, the 1xx permission and the 4096-octet sum, each
    // stated in more than one unit, and one rule each the other two steps.
    // Its `prefixes` and `storage-model` rows: one rule per unit, nine units
    // by nine rules. Its `considerations` rows: one rule per unit, except
    // §8.3's second paragraph, which has two, one per clause; the two
    // convention rules cover no unit.
    it('covers all 51 units, by 34 rules', () => {
      const covering = Object.values(coverage.rules).filter(
        (entry) => entry.covers.length > 0,
      );
      const covered = new Set(covering.flatMap((entry) => entry.covers));

      expect([...covered].sort()).toEqual(
        [
          '1/1',
          '3/1',
          '3/2',
          '3/3',
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
        ].sort(),
      );
      expect([...covered].sort()).toEqual(Object.keys(coverage.units).sort());
      expect(covering.length).toBe(34);
    });

    // The ids a recount of the pinned text yields under the counting rule:
    // the server's keyword paragraphs keyed `<section>/<n>`, the user
    // agent's steps keyed `<section>/step-<k>` by the draft's own number,
    // and the two unnumbered step paragraphs keyed `<section>/<n>`.
    it('declares the 51 units of the pinned revision', () => {
      expect(Object.keys(coverage.units)).toEqual([
        '1/1',
        '3/1',
        '3/2',
        '3/3',
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

    // Both kinds of unit count in the one N: 25 keyword paragraphs that bind
    // the server, and 26 user-agent steps of §5.5–§5.7 at which a browser
    // ignores or caps what the server sent.
    it('counts 25 server paragraphs and 26 user-agent steps', () => {
      const ids = Object.keys(coverage.units);
      const steps = ids.filter((id) => /^5\.[5-7][./]/.test(id));

      expect(steps.length).toBe(26);
      expect(ids.length - steps.length).toBe(25);
    });

    // The units no context can check: one requirement on the octets a
    // server processes, one on the browser's store, and seven that only the
    // origin knows or that the server's peer would have to show.
    it('has 9 informational entries, carrying no cells', () => {
      // Read as a plain string array: the informational and executable
      // branches' tuple types leave `includes` no argument type to accept.
      const informational = Object.entries(coverage.rules).filter(([, entry]) =>
        (entry.declared.types as readonly string[]).includes('informational'),
      );

      expect(informational.map(([name]) => name).sort()).toEqual([
        'rfc-6265bis/server-must-be-tolerant-of-multiple-cookie-headers',
        'rfc-6265bis/server-must-process-cookie-octets-as-us-ascii',
        'rfc-6265bis/server-should-avoid-session-fixation',
        'rfc-6265bis/server-should-degrade-gracefully-without-cookies',
        'rfc-6265bis/server-should-not-rely-on-cookie-serialization-order',
        'rfc-6265bis/server-should-not-rely-on-user-agents-retaining-cookies',
        'rfc-6265bis/server-should-not-share-sensitive-cookies-across-distrusting-paths',
        'rfc-6265bis/server-should-not-share-sensitive-cookies-across-distrusting-ports',
        'rfc-6265bis/user-agent-must-not-let-insecure-cookie-overlay-secure-cookie',
      ]);
      for (const [, entry] of informational) {
        expect(entry.contexts).toBeUndefined();
      }
    });

    // The cells the record carries, keyed by rule and context, keeping the
    // ones `keep` accepts: a heuristic cell marks a declared context no
    // single exchange settles, an impossible cell an undeclared one.
    function cellsWhere(keep: (cell: unknown) => boolean) {
      return Object.fromEntries(
        Object.entries(coverage.rules).flatMap(([name, entry]) => {
          const cells = Object.entries(entry.contexts ?? {}).filter(
            ([, cell]) => keep(cell),
          );

          return cells.length === 0 ? [] : [[name, Object.fromEntries(cells)]];
        }),
      );
    }

    // Nine rules are heuristic in every context, the conditional §8.3
    // clause and the SHOULDs with no ground truth among them; the cross-site
    // SameSite step is declared in `analytics` only, and heuristic there.
    it('carries 28 heuristic cells on 10 rules', () => {
      const everywhere = {
        static: 'heuristic',
        test: 'heuristic',
        analytics: 'heuristic',
      };

      expect(cellsWhere((cell) => cell === 'heuristic')).toEqual({
        'rfc-6265bis/origin-server-must-not-combine-set-cookie-fields':
          everywhere,
        'rfc-6265bis/server-requiring-higher-security-should-use-cookies-only-over-secure-channel':
          everywhere,
        'rfc-6265bis/server-should-avoid-large-cookies': everywhere,
        'rfc-6265bis/server-should-encrypt-and-sign-cookie-contents':
          everywhere,
        'rfc-6265bis/server-should-select-reasonable-cookie-expiration':
          everywhere,
        'rfc-6265bis/server-should-use-cookie-name-prefixes': everywhere,
        'rfc-6265bis/user-agent-must-cap-cookie-lifetime-at-400-days':
          everywhere,
        'rfc-6265bis/user-agent-must-ignore-cookie-with-public-suffix-domain':
          everywhere,
        'rfc-6265bis/user-agent-must-ignore-same-site-cookie-set-cross-site': {
          analytics: 'heuristic',
        },
        'rfc-6265bis/user-agent-must-ignore-unrecognized-cookie-attributes':
          everywhere,
      });
    });

    // The contexts an executable rule leaves undeclared, each with the
    // reason it cannot see the assertion and a note that says why; a
    // `tool-limitation` cites its ticket.
    it('carries 5 impossible cells on 3 rules', () => {
      const note = expect.stringMatching(/\S/);
      const impossible = (reason: string, issue?: string) => ({
        verdict: 'impossible',
        reason,
        note,
        ...(issue === undefined ? {} : { issue }),
      });

      expect(cellsWhere((cell) => cell !== 'heuristic')).toEqual({
        'rfc-6265bis/server-must-send-only-one-set-cookie-per-cookie-name': {
          static: impossible('not-representable'),
        },
        'rfc-6265bis/user-agent-may-ignore-set-cookie-in-1xx-response': {
          test: impossible(
            'tool-limitation',
            'thymianofficial/thymian-workspace#111',
          ),
          analytics: impossible(
            'tool-limitation',
            'thymianofficial/thymian-workspace#111',
          ),
        },
        'rfc-6265bis/user-agent-must-ignore-same-site-cookie-set-cross-site': {
          static: impossible('not-representable'),
          test: impossible('participant-not-reachable'),
        },
      });
    });
  });

  // A convention rule ships off and covers no unit: draft-22 imposes no such
  // obligation, and a profile turns it on for a reason its explanation
  // states. The checker does not enforce either, so they are asserted here.
  // That the explanation states the reason is left to review: ADR-0021 §3
  // accepts it cannot be tested mechanically.
  describe('the two convention rules', () => {
    const conventions = [
      'rfc-6265bis/server-should-send-cookies-only-over-https',
      'rfc-6265bis/server-should-set-http-only-on-every-cookie',
    ];

    it('are exactly the rules shipped off and not informational, covering no unit', async () => {
      const rules = await loadBaselineRules();
      const shippedOffExecutable = rules
        .filter(
          (rule) =>
            rule.meta.severity === 'off' &&
            !rule.meta.type.includes('informational'),
        )
        .map((rule) => rule.meta.name)
        .sort();
      const entries: Record<string, CoverageEntry> = coverage.rules;

      expect(shippedOffExecutable).toEqual(conventions);
      for (const name of conventions) {
        expect(entries[name]?.covers, name).toEqual([]);
      }
    }, 30_000);

    // `recommended` turns both on (`profiles.test.ts`), and the
    // zero-violation run above passes the checker's promotion assertion on
    // them; this proves the assertion read them rather than skipped them:
    // take the explanation away and each convention is reported.
    it('are the rows the checker holds to its promotion assertion', async () => {
      const rules = await loadBaselineRules();
      const unexplained = rules.map((rule) =>
        conventions.includes(rule.meta.name)
          ? { ...rule, meta: { ...rule.meta, explanation: undefined } }
          : rule,
      );
      const violations = checkCoverage({
        record: coverage,
        rules: unexplained,
        profiles: rfc6265bis.profiles,
      });

      expect(violations.map(({ rule }) => rule).sort()).toEqual(conventions);
      for (const violation of violations) {
        expect(violation.code).toBe('undocumented-promoted-rule');
      }
    }, 30_000);
  });

  // `recommended` promotes §8.3's Secure clause from its keyword's `warn` to
  // `error`. The checker reads a promotion only off a rule that ships `off`,
  // so the clause is held to the same assertion by handing the checker the
  // rule and its entry as if both shipped `off`: a concern tag, no heuristic
  // cell in a declared context, and an explanation.
  describe('the promoted Secure clause', () => {
    const SET_SECURE =
      'rfc-6265bis/server-should-set-secure-on-every-cookie-over-secure-channel';

    async function promotionViolations(
      meta: Partial<Rule['meta']> = {},
    ): Promise<CoverageViolation[]> {
      const rules = (await loadBaselineRules()).map((rule) =>
        rule.meta.name === SET_SECURE
          ? {
              ...rule,
              meta: { ...rule.meta, severity: 'off' as const, ...meta },
            }
          : rule,
      );
      const entries: Record<string, CoverageEntry> = coverage.rules;
      const entry = entries[SET_SECURE];
      if (entry === undefined) {
        throw new Error(`no coverage entry for ${SET_SECURE}`);
      }

      return checkCoverage({
        record: {
          ...coverage,
          rules: {
            ...entries,
            [SET_SECURE]: {
              ...entry,
              declared: { ...entry.declared, severity: 'off' },
            } as CoverageEntry,
          },
        },
        rules,
        profiles: rfc6265bis.profiles,
      });
    }

    it('passes the checker’s promotion assertion', async () => {
      expect(await promotionViolations()).toEqual([]);
    }, 30_000);

    it('is reported without its explanation, so the assertion read it', async () => {
      const violations = await promotionViolations({ explanation: undefined });

      expect(violations.map(({ rule, code }) => [rule, code])).toEqual([
        [SET_SECURE, 'undocumented-promoted-rule'],
      ]);
    }, 30_000);
  });
});
