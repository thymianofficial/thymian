import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { INSECURE, SECURE } from '../../test/builders.js';
import { fixtureContexts } from '../../test/harness.js';
import { loadTopicRules, reportedBy } from '../../test/topic-rules.js';
import grammarRule from '../syntax/server-must-send-set-cookie-conforming-to-grammar.rule.js';

// One defect, one violation. The `considerations` rules judge only a cookie a
// browser keeps: a cookie a §5.7 step ignores is that step's rule's, a
// Secure cookie set over plain http is step 13's, and a line that clears its
// cookie keeps none. A lifetime past 400 days is the cap rule's, and the
// expiry rule judges the ones below it. The two rules on cookies over plain
// http, §8.3's heuristic one and its convention twin, both report the same
// response by design: a profile turns one off when it turns the other on.
// A Secure cookie without a prefix is the prefix heuristic's, so the cases
// on lifetime and contents carry `__Host-` to keep it silent.

const here = dirname(fileURLToPath(import.meta.url));

const SET_SECURE =
  'rfc-6265bis/server-should-set-secure-on-every-cookie-over-secure-channel';
const ONLY_OVER_SECURE_CHANNEL =
  'rfc-6265bis/server-requiring-higher-security-should-use-cookies-only-over-secure-channel';
const HTTPS_ONLY = 'rfc-6265bis/server-should-send-cookies-only-over-https';
const HTTP_ONLY = 'rfc-6265bis/server-should-set-http-only-on-every-cookie';
const REASONABLE_EXPIRY =
  'rfc-6265bis/server-should-select-reasonable-cookie-expiration';
const ENCRYPT_AND_SIGN =
  'rfc-6265bis/server-should-encrypt-and-sign-cookie-contents';
const LIFETIME_CAP =
  'rfc-6265bis/user-agent-must-cap-cookie-lifetime-at-400-days';
const SAME_SITE_NONE =
  'rfc-6265bis/user-agent-must-ignore-same-site-none-cookie-without-secure';
const SECURE_PREFIX =
  'rfc-6265bis/user-agent-must-ignore-secure-prefixed-cookie-without-secure';
const SECURE_OVER_INSECURE =
  'rfc-6265bis/user-agent-must-ignore-secure-cookie-over-insecure-connection';
const NON_MATCHING_DOMAIN =
  'rfc-6265bis/user-agent-must-ignore-cookie-with-non-matching-domain';

const rules = [
  grammarRule,
  ...(await loadTopicRules(here)),
  ...(await loadTopicRules(join(here, '../set-cookie-processing'))),
  ...(await loadTopicRules(join(here, '../storage-model'))),
  ...(await loadTopicRules(join(here, '../prefixes'))),
];

type Origin = typeof SECURE | typeof INSECURE;

const cases: [string, Origin, string, string[]][] = [
  [
    'a cookie without Secure over https',
    SECURE,
    'SID=31d4; HttpOnly',
    [SET_SECURE],
  ],
  [
    'a cookie without Secure or HttpOnly over https',
    SECURE,
    'SID=31d4',
    [HTTP_ONLY, SET_SECURE],
  ],
  [
    'SameSite=None without Secure over https',
    SECURE,
    'SID=31d4; HttpOnly; SameSite=None',
    [SAME_SITE_NONE],
  ],
  [
    'a __Secure- cookie without Secure over https',
    SECURE,
    '__Secure-SID=31d4',
    [SECURE_PREFIX],
  ],
  [
    'a cookie without Secure for a foreign Domain',
    SECURE,
    'SID=31d4; Domain=example.org',
    [NON_MATCHING_DOMAIN],
  ],
  [
    'a line that clears a cookie without Secure or HttpOnly',
    SECURE,
    'SID=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    [],
  ],
  [
    'a cookie without Secure over plain http',
    INSECURE,
    'SID=31d4; HttpOnly',
    [HTTPS_ONLY, ONLY_OVER_SECURE_CHANNEL],
  ],
  [
    'a Secure cookie over plain http',
    INSECURE,
    'SID=31d4; Secure; HttpOnly',
    [SECURE_OVER_INSECURE],
  ],
  [
    'a session identifier that lasts 30 days',
    SECURE,
    '__Host-SID=31d4; Secure; HttpOnly; Path=/; Max-Age=2592000',
    [REASONABLE_EXPIRY],
  ],
  [
    'a session identifier that lasts past 400 days',
    SECURE,
    '__Host-SID=31d4; Secure; HttpOnly; Path=/; Max-Age=34560001',
    [LIFETIME_CAP],
  ],
  [
    'key-value pairs, percent-encoded',
    SECURE,
    '__Host-profile=uid%3D42%26role%3Dadmin; Secure; HttpOnly; Path=/',
    [ENCRYPT_AND_SIGN],
  ],
];

describe.each(fixtureContexts)('in %s', (context) => {
  it.each(cases)(
    'reports %s once, or not at all',
    async (_name, origin, line, expected) => {
      expect(await reportedBy(rules, context, [line], origin)).toEqual(
        expected.sort(),
      );
    },
  );
});
