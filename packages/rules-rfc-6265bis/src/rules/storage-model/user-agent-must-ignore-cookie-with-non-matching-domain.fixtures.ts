import {
  FALLBACK,
  recorded,
  SECURE,
  setCookieInputsAt,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './user-agent-must-ignore-cookie-with-non-matching-domain.rule.js';

// Requests go to api.example.com, which domain-matches example.com and not
// example.org.
const FOREIGN_DOMAIN = 'SID=31d4d96e407aad42; Domain=example.org';
const PARENT_DOMAIN = 'SID=31d4d96e407aad42; Domain=example.com';

const violating = setCookieInputsAt(SECURE, [FOREIGN_DOMAIN]);
const conforming = setCookieInputsAt(SECURE, [PARENT_DOMAIN]);
// http://localhost:8080 is what a document with no usable server URL loads
// as, so the request host may be Thymian's rather than the API's.
const fallback = setCookieInputsAt(FALLBACK, [PARENT_DOMAIN]);

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
  // Recorded traffic is real: localhost is judged like any other host, and
  // does not domain-match example.com.
  analytics: {
    violates: {
      transactions: [
        recorded({
          origin: FALLBACK,
          headers: setCookieLines([PARENT_DOMAIN]),
        }),
      ],
    },
    conforms: conforming.analytics,
  },
} satisfies RuleFixtures;
