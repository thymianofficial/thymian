import {
  apiDescription,
  recorded,
  respondWith,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './server-must-send-only-one-set-cookie-per-cookie-name.rule.js';

// Two field lines arrive as an array, from the dispatcher in `test` and from
// the recorded traffic in `analytics`. Each line on its own conforms: the
// defect is that both set SID. The conforming response sets two cookies
// whose names differ only in case, which makes them two cookies.
const twice = setCookieLines([
  'SID=31d4d96e407aad42; Path=/; Secure',
  'SID=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
]);
const distinct = setCookieLines([
  'SID=31d4d96e407aad42; Path=/; Secure',
  'sid=en-US; Path=/',
]);

export default {
  rule,
  test: {
    violates: {
      format: apiDescription({}),
      respond: respondWith({ headers: twice }),
    },
    conforms: {
      format: apiDescription({}),
      respond: respondWith({ headers: distinct }),
    },
  },
  analytics: {
    violates: { transactions: [recorded({ headers: twice })] },
    conforms: { transactions: [recorded({ headers: distinct })] },
  },
} satisfies RuleFixtures;
