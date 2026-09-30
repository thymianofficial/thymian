import {
  createRuleFilter,
  deriveMinimalProfile,
  loadRules,
  ruleTypes,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6797 from './index.js';

// What a run without a `ruleSeverity` loads: the CLI's default floor is
// `error`, which keeps a rule at that severity, whatever its type.
const atDefaultSeverityFloor = createRuleFilter({
  severity: 'error',
  type: [...ruleTypes],
});

async function namesLoadedUnder(profile: string): Promise<string[]> {
  const rules = await loadRules(
    '@thymian/rules-rfc-6797',
    atDefaultSeverityFloor,
    {},
    undefined,
    { '@thymian/rules-rfc-6797': profile },
  );

  return rules.map((rule) => rule.meta.name).sort();
}

// The seven rules RFC 6797 makes a MUST that one exchange settles exactly.
const exactErrorRules = [
  'rfc-6797/hsts-host-must-not-repeat-sts-directives',
  'rfc-6797/hsts-host-must-not-send-sts-header-over-insecure-transport',
  'rfc-6797/hsts-host-must-send-include-subdomains-without-value',
  'rfc-6797/hsts-host-must-send-max-age-as-delta-seconds',
  'rfc-6797/hsts-host-must-send-max-age-directive',
  'rfc-6797/hsts-host-must-send-only-one-sts-header',
  'rfc-6797/hsts-host-must-send-sts-header-conforming-to-grammar',
];

// Drift guard: every rule id a shipped profile names must be a real rule, and
// `minimal` must be the one derived from the coverage record, never a
// hand-kept list.
describe('rfc-6797 rule-configuration profiles', () => {
  it('ships recommended, strict and minimal', () => {
    expect(Object.keys(rfc6797.profiles ?? {}).sort()).toEqual([
      'minimal',
      'recommended',
      'strict',
    ]);
  });

  it('lists only real rule ids in every profile', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6797');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    for (const [profile, config] of Object.entries(rfc6797.profiles ?? {})) {
      for (const id of Object.keys(config)) {
        expect(ruleIds.has(id), `${profile} names "${id}"`).toBe(true);
      }
    }
  }, 30_000);

  it('derives minimal from the coverage record', () => {
    expect(rfc6797.profiles?.minimal).toEqual(deriveMinimalProfile(coverage));
  });

  // The derivation's result, pinned: exact `error` rules only, so a CI gate
  // on `minimal` never fails on a guess — no heuristic and no informational
  // rule, although two informational rules ship at `error`.
  it('loads exactly the seven exact error rules under minimal', async () => {
    expect(await namesLoadedUnder('minimal')).toEqual(exactErrorRules);
  }, 30_000);

  it('ships an empty strict profile: shipped severities are source fidelity', () => {
    expect(rfc6797.profiles?.strict).toEqual({});
  });

  // An empty profile must not be an empty run: under the default floor,
  // `strict` loads every rule shipped at `error` — the seven exact ones and
  // the two informational ones, which report their impossibility.
  it('still loads the error rules under strict at the default severity floor', async () => {
    expect(await namesLoadedUnder('strict')).toEqual(
      [
        ...exactErrorRules,
        'rfc-6797/hsts-host-must-not-treat-empty-path-as-slash-when-comparing-effective-request-uris',
        'rfc-6797/user-agent-must-enforce-hsts-policy',
      ].sort(),
    );
  }, 30_000);

  // The two twins carry the checks the RFC makes conditional on a host
  // having chosen HSTS, exactly and of every server; each replaces the rule
  // it twins, so one response is reported once.
  it('turns the conventions on and the two rules they twin off in recommended', () => {
    expect(rfc6797.profiles?.recommended).toEqual({
      'rfc-6797/server-should-send-sts-header-over-secure-transport': 'error',
      'rfc-6797/server-may-establish-hsts-over-secure-transport': 'off',
      'rfc-6797/server-should-redirect-insecure-requests-to-https': 'error',
      'rfc-6797/hsts-host-should-redirect-insecure-requests-to-https': 'off',
      'rfc-6797/server-should-send-sts-max-age-of-at-least-one-year': 'warn',
      'rfc-6797/server-should-send-sts-preload-directive': 'hint',
    });
  });
});
