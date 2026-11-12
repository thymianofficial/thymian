import { recorded, setCookieLines } from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
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
export default {
  rule,
  analytics: {
    violates: {
      transactions: [
        recorded({
          requestHeaders: CROSS_SITE_FETCH,
          headers: setCookieLines([LAX]),
        }),
      ],
    },
    // SameSite=None may be set cross-site; any cookie may be set on a
    // top-level navigation; a request without Fetch Metadata shows nothing.
    conforms: {
      transactions: [
        recorded({
          requestHeaders: CROSS_SITE_FETCH,
          headers: setCookieLines([
            'SID=31d4d96e407aad42; Secure; SameSite=None',
          ]),
        }),
        recorded({
          path: '/login',
          requestHeaders: CROSS_SITE_NAVIGATION,
          headers: setCookieLines([LAX]),
        }),
        recorded({ path: '/api', headers: setCookieLines([LAX]) }),
      ],
    },
  },
} satisfies RuleFixtures;
