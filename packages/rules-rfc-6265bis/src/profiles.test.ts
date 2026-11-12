import {
  createRuleFilter,
  deriveMinimalProfile,
  loadRules,
  type RuleSeverity,
  ruleTypes,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import coverage from './coverage.js';
import rfc6265bis from './index.js';

// What a run loads under a profile. The CLI's default floor is `error`,
// which keeps a rule at that severity, whatever its type; `hint` keeps every
// rule a profile does not turn off.
async function namesLoadedUnder(
  profile: string,
  severity: RuleSeverity = 'error',
): Promise<string[]> {
  const rules = await loadRules(
    '@thymian/rules-rfc-6265bis',
    createRuleFilter({ severity, type: [...ruleTypes] }),
    {},
    undefined,
    { '@thymian/rules-rfc-6265bis': profile },
  );

  return rules.map((rule) => rule.meta.name).sort();
}

const HTTP_ONLY = 'rfc-6265bis/server-should-set-http-only-on-every-cookie';
const HTTPS_ONLY = 'rfc-6265bis/server-should-send-cookies-only-over-https';
const ONLY_OVER_SECURE_CHANNEL =
  'rfc-6265bis/server-requiring-higher-security-should-use-cookies-only-over-secure-channel';
const SET_SECURE =
  'rfc-6265bis/server-should-set-secure-on-every-cookie-over-secure-channel';

// The twelve rules draft-22 makes a MUST, or a user-agent step that ignores
// a cookie or overrides what the server sent, that one exchange settles
// exactly.
const exactErrorRules = [
  'rfc-6265bis/server-must-not-repeat-cookie-attributes',
  'rfc-6265bis/server-must-not-send-whitespace-around-extension-attributes',
  'rfc-6265bis/server-must-send-only-one-set-cookie-per-cookie-name',
  'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar',
  'rfc-6265bis/user-agent-must-ignore-attribute-value-over-1024-octets',
  'rfc-6265bis/user-agent-must-ignore-cookie-over-4096-octets',
  'rfc-6265bis/user-agent-must-ignore-cookie-with-non-matching-domain',
  'rfc-6265bis/user-agent-must-ignore-host-prefixed-cookie-unless-host-locked',
  'rfc-6265bis/user-agent-must-ignore-same-site-none-cookie-without-secure',
  'rfc-6265bis/user-agent-must-ignore-secure-cookie-over-insecure-connection',
  'rfc-6265bis/user-agent-must-ignore-secure-prefixed-cookie-without-secure',
  'rfc-6265bis/user-agent-must-replace-path-not-starting-with-slash',
];

// The two informational rules shipped at `error`, which report their
// impossibility.
const informationalErrorRules = [
  'rfc-6265bis/server-must-be-tolerant-of-multiple-cookie-headers',
  'rfc-6265bis/user-agent-must-not-let-insecure-cookie-overlay-secure-cookie',
];

// Drift guard: every rule id a shipped profile names must be a real rule, and
// `minimal` must be the one derived from the coverage record, never a
// hand-kept list.
describe('rfc-6265bis rule-configuration profiles', () => {
  it('ships recommended, strict and minimal', () => {
    expect(Object.keys(rfc6265bis.profiles ?? {}).sort()).toEqual([
      'minimal',
      'recommended',
      'strict',
    ]);
  });

  it('lists only real rule ids in every profile', async () => {
    const rules = await loadRules('@thymian/rules-rfc-6265bis');
    const ruleIds = new Set(rules.map((rule) => rule.meta.name));

    for (const [profile, config] of Object.entries(rfc6265bis.profiles ?? {})) {
      for (const id of Object.keys(config)) {
        expect(ruleIds.has(id), `${profile} names "${id}"`).toBe(true);
      }
    }
  }, 30_000);

  it('derives minimal from the coverage record', () => {
    expect(rfc6265bis.profiles?.minimal).toEqual(
      deriveMinimalProfile(coverage),
    );
  });

  // The derivation's result, pinned: exact `error` rules only, so a CI gate
  // on `minimal` never fails on a guess — no heuristic and no informational
  // rule, although two informational rules ship at `error`.
  it('loads exactly the twelve exact error rules under minimal', async () => {
    expect(await namesLoadedUnder('minimal')).toEqual(exactErrorRules);
  }, 30_000);

  it('ships an empty strict profile: shipped severities are source fidelity', () => {
    expect(rfc6265bis.profiles?.strict).toEqual({});
  });

  // An empty profile must not be an empty run: under the default floor,
  // `strict` loads every rule shipped at `error`.
  it('still loads the error rules under strict at the default severity floor', async () => {
    expect(await namesLoadedUnder('strict')).toEqual(
      [...exactErrorRules, ...informationalErrorRules].sort(),
    );
  }, 30_000);

  // The opinionated layer: both conventions on, HttpOnly at `warn` and
  // https-only at `error`; the heuristic §8.3 rule the https-only twin
  // replaces off; and §8.3's exact Secure clause promoted from its keyword's
  // `warn`.
  it('turns the conventions on, the rule the twin replaces off, and promotes the Secure clause in recommended', () => {
    expect(rfc6265bis.profiles?.recommended).toEqual({
      [HTTP_ONLY]: 'warn',
      [HTTPS_ONLY]: 'error',
      [ONLY_OVER_SECURE_CHANNEL]: 'off',
      [SET_SECURE]: 'error',
    });
  });

  // One response is reported once: a cookie set over plain http is the
  // twin's under `recommended`, and §8.3's heuristic rule's under `strict`,
  // never both.
  it('loads the https-only twin in place of the heuristic §8.3 rule under recommended', async () => {
    const recommended = await namesLoadedUnder('recommended', 'hint');
    const strict = await namesLoadedUnder('strict', 'hint');

    expect(recommended).toContain(HTTPS_ONLY);
    expect(recommended).toContain(HTTP_ONLY);
    expect(recommended).not.toContain(ONLY_OVER_SECURE_CHANNEL);
    expect(strict).toContain(ONLY_OVER_SECURE_CHANNEL);
    expect(strict).not.toContain(HTTPS_ONLY);
    expect(strict).not.toContain(HTTP_ONLY);
  }, 30_000);

  // Under the default floor, `recommended` adds the two rules it raises to
  // `error` to what `strict` loads, and nothing else.
  it('loads the twin and the promoted Secure clause beside the error rules under recommended', async () => {
    expect(await namesLoadedUnder('recommended')).toEqual(
      [
        ...exactErrorRules,
        ...informationalErrorRules,
        HTTPS_ONLY,
        SET_SECURE,
      ].sort(),
    );
  }, 30_000);
});
