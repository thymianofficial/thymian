import {
  FALLBACK,
  recorded,
  SECURE,
  setCookieInputsAt,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './user-agent-must-ignore-cookie-with-public-suffix-domain.rule.js';

// Requests go to api.example.com, which domain-matches both com, a public
// suffix, and example.com, its registrable domain.
const violating = setCookieInputsAt(SECURE, [
  'SID=31d4d96e407aad42; Domain=com',
]);
const conforming = setCookieInputsAt(SECURE, [
  'SID=31d4d96e407aad42; Domain=example.com',
]);
// http://localhost:8080 is what a document with no usable server URL loads
// as, so the request host may be Thymian's rather than the API's.
const fallback = setCookieInputsAt(FALLBACK, [
  'SID=31d4d96e407aad42; Domain=com',
]);

export default {
  rule,
  static: {
    violates: violating.static,
    conforms: conforming.static,
    skips: fallback.static,
  },
  // The recorded request carries the described origin, so the same fallback
  // reaches `test`.
  test: {
    violates: violating.test,
    conforms: conforming.test,
    skips: fallback.test,
  },
  // Recorded traffic is real: localhost is judged like any other host, and a
  // single-label Domain identical to it makes the cookie host-only instead.
  analytics: {
    violates: violating.analytics,
    conforms: {
      transactions: [
        ...(conforming.analytics.transactions ?? []),
        recorded({
          origin: FALLBACK,
          headers: setCookieLines(['SID=31d4d96e407aad42; Domain=localhost']),
        }),
      ],
    },
  },
} satisfies RuleFixtures;
