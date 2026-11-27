import { checkCoverage, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc9110 from './index.js';

// A profile name that can't match any real one, so `resolveProfileConfig`'s
// documented fallback -- an unknown profile resolves to an empty override
// map -- gives every rule at its literal shipped `meta`, which is what
// `checkCoverage`'s stamp and citation-requirement assertions need. Same
// trick `scripts/generate-coverage.ts` uses.
const BASELINE_PROFILE_SENTINEL = '__coverage_test_baseline__';

async function loadBaselineRules() {
  return loadRules('@thymian/rules-rfc-9110', undefined, {}, undefined, {
    '@thymian/rules-rfc-9110': BASELINE_PROFILE_SENTINEL,
  });
}

// #157-#162 each landed a block here scoped to its own directories, so a
// batch was verifiable on its own while the rest of the record was still
// empty (the checker's own scope contract, #152). #163 is the gate
// closing: every batch has landed, so this folds those six blocks into one
// unscoped assertion over the whole corpus -- the real loader against the
// real package, the same seam the tag sweep and the executability gate
// both used.
describe('coverage record', () => {
  it('reports zero violations over the whole corpus', async () => {
    const rules = await loadBaselineRules();
    const violations = checkCoverage({
      record: coverage,
      rules,
      profiles: rfc9110.profiles,
    });

    expect(violations).toEqual([]);
  }, 30_000);

  // The census: exact counts, not just "no violations" -- a checker that
  // silently skipped every rule would also report zero. These numbers are
  // #163's own drift guard, measured against the real loaded corpus rather
  // than asserted from memory.
  describe('the census', () => {
    it('loads all 402 rules', async () => {
      const rules = await loadBaselineRules();
      expect(rules.length).toBe(402);
    }, 30_000);

    it('has exactly one entry per loaded rule', async () => {
      const rules = await loadBaselineRules();
      expect(Object.keys(coverage.rules).length).toBe(rules.length);
    }, 30_000);

    it('has 231 informational entries, none carrying cells', () => {
      const informational = Object.values(coverage.rules).filter((entry) =>
        entry.declared.types.includes('informational'),
      );

      expect(informational.length).toBe(231);
      expect(informational.every((entry) => entry.contexts === undefined)).toBe(
        true,
      );
    });

    it('carries 205 cells, each with a reason and a non-empty note', () => {
      const cells = Object.values(coverage.rules).flatMap((entry) =>
        entry.contexts === undefined ? [] : Object.values(entry.contexts),
      );

      expect(cells.length).toBe(205);
      expect(
        cells.every(
          (cell) =>
            typeof cell === 'object' &&
            typeof cell.reason === 'string' &&
            cell.note.trim().length > 0,
        ),
      ).toBe(true);
    });
  });

  // Two of the checker's eight properties have no applicable rows in this
  // corpus -- proven here rather than left looking like coverage. Both are
  // exercised by core's own fixtures (a document-agnostic source with no
  // keyword basis; a profile that sets a rule above its shipped severity),
  // so the assertions themselves are real; RFC 9110 and rfc9110's own
  // profiles just never trigger them.
  describe('two assertions with nothing to bite on here', () => {
    it('never needs a cited source: RFC 9110 is keyword-bearing', () => {
      expect(coverage.source.hasKeywordBasis).toBe(true);
    });

    // A promotion is a profile entry strictly above the rule's shipped
    // severity. rfc9110's profiles never set one: they turn rules off, lower
    // them, or narrow their contexts. With every explanation taken away, any
    // promotion would be reported as `undocumented-promoted-rule`, so none
    // reported means none exists.
    it('has no promotion in any shipped profile', async () => {
      const rules = (await loadBaselineRules()).map((rule) => ({
        ...rule,
        meta: { ...rule.meta, explanation: undefined },
      }));
      const violations = checkCoverage({
        record: coverage,
        rules,
        profiles: rfc9110.profiles,
      });

      expect(
        violations.filter(({ code }) => code === 'undocumented-promoted-rule'),
      ).toEqual([]);
    }, 30_000);
  });
});
