import { deriveMinimalProfile, loadRules } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6797 from './index.js';

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

  // error severity, not heuristic, observable in a declared context
  it('keeps exactly the 7 exact error rules in minimal', async () => {
    const rules = await loadRules(
      '@thymian/rules-rfc-6797',
      undefined,
      {},
      undefined,
      {
        '@thymian/rules-rfc-6797': 'minimal',
      },
    );
    const enabled = rules.filter(
      (rule) =>
        rule.meta.severity !== 'off' &&
        !rule.meta.type.includes('informational'),
    );

    expect(enabled.map((rule) => rule.meta.name).sort()).toEqual([
      'rfc-6797/hsts-host-must-not-repeat-sts-directives',
      'rfc-6797/hsts-host-must-not-send-sts-header-over-insecure-transport',
      'rfc-6797/hsts-host-must-send-include-subdomains-without-value',
      'rfc-6797/hsts-host-must-send-max-age-as-delta-seconds',
      'rfc-6797/hsts-host-must-send-max-age-directive',
      'rfc-6797/hsts-host-must-send-only-one-sts-header',
      'rfc-6797/hsts-host-must-send-sts-header-conforming-to-grammar',
    ]);
  }, 30_000);

  it('ships an empty strict profile: shipped severities are source fidelity', () => {
    expect(rfc6797.profiles?.strict).toEqual({});
  });

  // The `ruleSeverity: 'error'` floor filter runs after the profile, so a
  // package whose strict profile held no error rule would load nothing by
  // default.
  it('keeps error rules under strict, so the default floor filter loads some', async () => {
    const rules = await loadRules(
      '@thymian/rules-rfc-6797',
      undefined,
      {},
      undefined,
      {
        '@thymian/rules-rfc-6797': 'strict',
      },
    );

    expect(
      rules.filter(
        (rule) =>
          rule.meta.severity === 'error' &&
          !rule.meta.type.includes('informational'),
      ).length,
    ).toBeGreaterThan(0);
  }, 30_000);
});
