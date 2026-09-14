import { loadRules, tier1ImpossibilityReasons } from '@thymian/core';
import { describe, expect, it } from 'vitest';

// The gate-closing meta-test (thymianofficial/thymian-workspace#109), on the
// seam profiles.test.ts established and tags.test.ts reused: load the real
// package through the real loader and assert over `rule.meta` for all 402
// rules at once. This is the only seam that can see the corpus, and it is
// what makes "every informational rule says why" a build fact rather than a
// sentence in a README.

// The corpus's one deliberate exception (thymianofficial/thymian-workspace#116):
// TCP/stream-layer tunnel-teardown behaviour that may not be an HTTP-layer
// conformance statement at all, left bare pending the separate ADR-0021
// mis-declaration audit. Named explicitly so a second unreasoned rule cannot
// silently join it.
const PENDING_AUDIT_EXCEPTION =
  'rfc9110/intermediary-must-attempt-to-send-outstanding-data-coming-from-closed-side-for-connect-request';

const tier1Codes = new Set(Object.keys(tier1ImpossibilityReasons));

function isIssueReference(value: unknown): boolean {
  return typeof value === 'string' && /#\d+$/.test(value);
}

function isInformational(rule: { meta: { type: string[] } }): boolean {
  return rule.meta.type.length === 1 && rule.meta.type[0] === 'informational';
}

describe('the executability gate — completeness (thymianofficial/thymian-workspace#109)', () => {
  it('resolves the package to 402 rules', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    expect(rules.length).toBe(402);
  }, 30_000);

  it('declares exactly 231 rules informational', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    expect(rules.filter(isInformational).length).toBe(231);
  }, 30_000);

  it('carries an impossibility reason on every informational rule but the one named, tracked exception', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');
    const unreasoned = rules
      .filter(isInformational)
      .filter((rule) => !rule.meta.impossibility);

    expect(unreasoned.map((rule) => rule.meta.name)).toEqual([
      PENDING_AUDIT_EXCEPTION,
    ]);
  }, 30_000);

  it('carries only a tier-1 code, for every reason in the corpus', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    for (const rule of rules) {
      if (rule.meta.impossibility) {
        expect(
          tier1Codes.has(rule.meta.impossibility.reason),
          `"${rule.meta.impossibility.reason}" on "${rule.meta.name}" is not a tier-1 code`,
        ).toBe(true);
      }
    }
  }, 30_000);

  it('never carries an impossibility reason on an executable rule', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    for (const rule of rules) {
      if (!isInformational(rule)) {
        expect(
          rule.meta.impossibility,
          `"${rule.meta.name}" is executable but carries an impossibility reason`,
        ).toBeUndefined();
      }
    }
  }, 30_000);

  it('cites a real issue reference on every tool-limitation', async () => {
    const rules = await loadRules('@thymian/rules-rfc-9110');

    for (const rule of rules) {
      const impossibility = rule.meta.impossibility;

      if (impossibility?.reason === 'tool-limitation') {
        expect(
          isIssueReference(impossibility.issue),
          `"${rule.meta.name}"'s tool-limitation issue "${impossibility.issue}" is not a real issue reference`,
        ).toBe(true);
      }
    }
  }, 30_000);
});
