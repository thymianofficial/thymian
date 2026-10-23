import {
  apiDescription,
  recorded,
  respondWith,
  setCookieHeader,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './origin-server-may-send-set-cookie-with-any-response.rule.js';

// Presence is a header name, so `static` needs no pinned value: a declared
// Set-Cookie uses the mechanism whatever its value.
const cookie = setCookieLines(['SID=31d4d96e407aad42; Path=/; Secure']);

export default {
  rule,
  static: {
    violates: { format: apiDescription({}) },
    conforms: {
      format: apiDescription({ response: { headers: setCookieHeader() } }),
    },
  },
  test: {
    violates: { format: apiDescription({}), respond: respondWith({}) },
    conforms: {
      format: apiDescription({}),
      respond: respondWith({ headers: cookie }),
    },
  },
  analytics: {
    violates: { transactions: [recorded({})] },
    conforms: { transactions: [recorded({ headers: cookie })] },
  },
} satisfies RuleFixtures;
