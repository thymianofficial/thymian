import { expect, it } from 'vitest';

import { onResponses } from '../../test/set-cookie.js';
import rule from './user-agent-must-ignore-same-site-cookie-set-cross-site.rule.js';

// A fetch() from another site, and a link from another site followed in the
// top-level window, as their Fetch Metadata shows them.
const CROSS_SITE_FETCH = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};
const CROSS_SITE_NAVIGATION = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

const LAX = 'SID=31d4d96e407aad42; Secure; SameSite=Lax';

// `analytics` only: an API description does not say which site a request
// comes from, and Thymian sends its test requests from no site at all.
it('flags, in analytics, a SameSite=Lax cookie set by a cross-site fetch', async () => {
  const {
    executions,
    transactions: [laxOnFetch, noneOnFetch, laxOnNavigation, withoutMetadata],
  } = await onResponses(rule, 'analytics', [
    { lines: [LAX], recordedRequest: { headers: CROSS_SITE_FETCH } },
    // SameSite=None may be set cross-site.
    {
      lines: ['SID=31d4d96e407aad42; Secure; SameSite=None'],
      recordedRequest: { headers: CROSS_SITE_FETCH },
    },
    // Any cookie may be set on a top-level navigation.
    {
      path: '/login',
      lines: [LAX],
      recordedRequest: { headers: CROSS_SITE_NAVIGATION },
    },
    // A request without Fetch Metadata shows nothing.
    { path: '/api', lines: [LAX] },
  ]);

  expect(executions).toMatchObject([
    {
      location: { elementId: laxOnFetch },
      status: 'failed',
      severity: 'warn',
      message: expect.stringContaining(
        'A user agent ignores the cookie "SID" entirely (§5.7 step 18): it has SameSite=Lax, and the request it answers is cross-site and no top-level navigation',
      ),
    },
    { location: { elementId: noneOnFetch }, status: 'passed' },
    { location: { elementId: laxOnNavigation }, status: 'passed' },
    { location: { elementId: withoutMetadata }, status: 'passed' },
  ]);
});
