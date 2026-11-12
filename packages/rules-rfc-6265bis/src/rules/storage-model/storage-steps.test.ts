import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HttpRequest } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { recorded, setCookieLines } from '../../test/builders.js';
import { fixtureContexts, runInContext } from '../../test/harness.js';
import { loadTopicRules, reportedBy } from '../../test/topic-rules.js';
import grammarRule from '../syntax/server-must-send-set-cookie-conforming-to-grammar.rule.js';
import { receivedCookie } from '../utils/set-cookie.js';
import { hostPrefixFailures } from '../utils/storage-model.js';

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
const CROSS_SITE =
  'rfc-6265bis/user-agent-must-ignore-same-site-cookie-set-cross-site';

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
  // Whether a line clears its cookie is judged against its response's Date,
  // never the time of the run; without a Date only the epoch clears it.
  [
    'a Secure, host-locked cookie whose Expires lies in the past, with no Date',
    'SID=31d4; Secure; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    [USE_PREFIXES],
  ],
  [
    'a Secure, host-locked line that clears its cookie with the epoch',
    'SID=; Secure; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    [],
  ],
  // A browser enforces a miscapitalized prefix, a server reading the
  // draft's spelling does not see it.
  [
    'a Secure cookie with a miscapitalized __Secure- prefix',
    '__secure-SID=31d4; Secure',
    [USE_PREFIXES],
  ],
  [
    'a host-locked cookie with a miscapitalized __Host- prefix',
    '__HOST-SID=31d4; Secure; Path=/',
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

// Fetch Metadata as a browser sends it for a fetch() from another site, an
// iframe from another site, and a link from another site followed in the
// top-level window.
const CROSS_SITE_FETCH = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};
const CROSS_SITE_IFRAME = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'iframe',
};
const CROSS_SITE_NAVIGATION = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

async function reportedOnRecorded(
  line: string,
  path: string,
  requestHeaders: NonNullable<HttpRequest['headers']> = {},
): Promise<string[]> {
  const names: string[] = [];
  for (const rule of rules.filter((r) => r.meta.type.includes('analytics'))) {
    const results = await runInContext('analytics', rule, {
      transactions: [
        recorded({ path, requestHeaders, headers: setCookieLines([line]) }),
      ],
    });
    if (results.some((result) => result.violation !== undefined)) {
      names.push(rule.meta.name);
    }
  }
  return names.sort();
}

// Step 18 is read off recorded Fetch Metadata, and the default-path off the
// recorded path.
describe('in analytics, on a recorded request', () => {
  it.each<[string, string, string, Record<string, string>, string[]]>([
    [
      'a Secure, host-locked SameSite=Lax cookie set by a cross-site fetch',
      'SID=31d4; Secure; Path=/; SameSite=Lax',
      '/api',
      CROSS_SITE_FETCH,
      [CROSS_SITE],
    ],
    [
      'a cookie without SameSite set by a cross-site fetch',
      'SID=31d4; Secure; Path=/',
      '/api',
      CROSS_SITE_FETCH,
      [CROSS_SITE],
    ],
    [
      'a SameSite=Lax cookie set in a cross-site iframe',
      'SID=31d4; Secure; Path=/; SameSite=Lax',
      '/widget',
      CROSS_SITE_IFRAME,
      [CROSS_SITE],
    ],
    [
      'a __Host- cookie set on a cross-site top-level navigation',
      '__Host-SID=31d4; Secure; Path=/; SameSite=Lax',
      '/login',
      CROSS_SITE_NAVIGATION,
      [],
    ],
    [
      'a SameSite=None cookie without Secure set by a cross-site fetch',
      'SID=31d4; SameSite=None',
      '/api',
      CROSS_SITE_FETCH,
      [SAME_SITE_NONE],
    ],
    [
      'a __Host- cookie whose Path is read as a default-path other than /',
      '__Host-SID=31d4; Secure; Path=app',
      '/app/login?next=/',
      {},
      [HOST_PREFIX],
    ],
  ])(
    'reports %s once, or not at all',
    async (_name, line, path, requestHeaders, expected) => {
      expect(await reportedOnRecorded(line, path, requestHeaders)).toEqual(
        expected,
      );
    },
  );
});

// §5.1.4 takes the default-path from the uri-path alone. A path with a
// query reaches a rule as `/login?next=/app/home` where nothing encodes the
// "/" in it, and the default-path is still /.
describe('the default-path of a path with a query', () => {
  const cookie = receivedCookie('__Host-SID=31d4; Secure; Path=app');
  if (cookie === undefined) {
    throw new Error('a user agent keeps the cookie');
  }

  it.each([
    ['/login?next=/app/home', []],
    ['/login#/app/home', []],
    ['/app/login?next=/', ['its path is /app, not /']],
  ])('of %s holds the __Host- cookie to %j', (path, failures) => {
    expect(
      hostPrefixFailures(cookie, {
        origin: 'https://api.example.com',
        path,
        headers: {},
        transportJudged: true,
      }),
    ).toEqual(failures);
  });
});
