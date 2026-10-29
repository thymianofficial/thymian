import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fixtureContexts } from '../../test/harness.js';
import { loadTopicRules, reportedBy } from '../../test/topic-rules.js';
import grammarRule from '../syntax/server-must-send-set-cookie-conforming-to-grammar.rule.js';

// One dropped cookie, one violation. §5.7 aborts at the first step that
// ignores a cookie, and the rules on its steps follow it: each speaks only
// where its step is the one that ignores the cookie, so a cookie that breaks
// two steps is reported by the first. A missing Secure that both SameSite=None
// and a prefix require is reported once, at step 19; a Domain the host does
// not domain-match hides what a later step would say. The prefix heuristic
// speaks only on a cookie a browser keeps. A line a user agent ignores on
// receipt is the grammar rule's alone.

const here = dirname(fileURLToPath(import.meta.url));

const GRAMMAR = 'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';
const USE_PREFIXES = 'rfc-6265bis/server-should-use-cookie-name-prefixes';
const HOST_PREFIX =
  'rfc-6265bis/user-agent-must-ignore-host-prefixed-cookie-unless-host-locked';
const NON_MATCHING_DOMAIN =
  'rfc-6265bis/user-agent-must-ignore-cookie-with-non-matching-domain';
const SAME_SITE_NONE =
  'rfc-6265bis/user-agent-must-ignore-same-site-none-cookie-without-secure';
const SECURE_PREFIX =
  'rfc-6265bis/user-agent-must-ignore-secure-prefixed-cookie-without-secure';
const PUBLIC_SUFFIX =
  'rfc-6265bis/user-agent-must-ignore-cookie-with-public-suffix-domain';

const rules = [
  grammarRule,
  ...(await loadTopicRules(here)),
  ...(await loadTopicRules(join(here, '../prefixes'))),
];

// Every request is served from https://api.example.com.
const cases: [string, string, string[]][] = [
  [
    'a __Secure- cookie with SameSite=None and no Secure',
    '__Secure-SID=31d4; SameSite=None',
    [SAME_SITE_NONE],
  ],
  [
    'a __Host- cookie with SameSite=None and no Secure',
    '__Host-SID=31d4; SameSite=None; Path=/',
    [SAME_SITE_NONE],
  ],
  [
    'a __Host- cookie with SameSite=None, Secure and no Path',
    '__Host-SID=31d4; SameSite=None; Secure',
    [HOST_PREFIX],
  ],
  ['a __Host- cookie without Secure', '__Host-SID=31d4; Path=/', [HOST_PREFIX]],
  [
    'a __Host- cookie on a path other than /',
    '__Host-SID=31d4; Secure; Path=/app',
    [HOST_PREFIX],
  ],
  // §5.6.4 records such a Path as the default-path, here /, so the cookie
  // is host-locked after all.
  [
    'a __Host- cookie whose Path does not start with /, read as the default-path /',
    '__Host-SID=31d4; Secure; Path=app',
    [],
  ],
  [
    'a __Secure- cookie without Secure, its prefix in upper case',
    '__SECURE-SID=31d4',
    [SECURE_PREFIX],
  ],
  [
    'a public-suffix Domain on a cookie with SameSite=None and no Secure',
    'SID=31d4; Domain=com; SameSite=None',
    [SAME_SITE_NONE],
  ],
  [
    'a public-suffix Domain on a cookie a browser otherwise keeps',
    'SID=31d4; Domain=com; Secure',
    [PUBLIC_SUFFIX],
  ],
  [
    'a __Secure- cookie without Secure for a foreign Domain',
    '__Secure-SID=31d4; Domain=example.org',
    [NON_MATCHING_DOMAIN],
  ],
  [
    'a Secure, host-locked cookie for a foreign Domain',
    'SID=31d4; Secure; Path=/; Domain=example.org',
    [NON_MATCHING_DOMAIN],
  ],
  [
    'a Secure, host-locked cookie without a prefix',
    'SID=31d4; Secure; Path=/',
    [USE_PREFIXES],
  ],
  [
    'an empty name with a prefixed value',
    '=__Host-SID; Secure; Path=/',
    [GRAMMAR],
  ],
];

describe.each(fixtureContexts)('in %s', (context) => {
  it.each(cases)(
    'reports %s once, or not at all',
    async (_name, line, expected) => {
      expect(await reportedBy(rules, context, [line])).toEqual(expected);
    },
  );
});
