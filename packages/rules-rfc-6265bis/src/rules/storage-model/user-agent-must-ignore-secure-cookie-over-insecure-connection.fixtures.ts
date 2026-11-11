import {
  apiDescription,
  FALLBACK,
  INSECURE,
  recorded,
  respondByScheme,
  setCookieHeader,
  setCookieInputsAt,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './user-agent-must-ignore-secure-cookie-over-insecure-connection.rule.js';

const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';
const PLAIN_COOKIE = 'lang=en-US';

const violating = setCookieInputsAt(INSECURE, [SECURE_COOKIE]);
// http://localhost:8080 is what a document with no usable server URL loads
// as, so its scheme may be Thymian's rather than the API's.
const fallback = setCookieInputsAt(FALLBACK, [SECURE_COOKIE]);

// The Secure cookie over https, and a cookie without Secure over plain http:
// judged on the scheme and the cookie together.
export default {
  rule,
  static: {
    violates: violating.static,
    conforms: {
      format: apiDescription(
        { response: { headers: setCookieHeader(SECURE_COOKIE) } },
        {
          request: INSECURE,
          response: { headers: setCookieHeader(PLAIN_COOKIE) },
        },
      ),
    },
    skips: fallback.static,
  },
  // The recorded request carries the described origin, so the same fallback
  // reaches `test`.
  test: {
    violates: violating.test,
    conforms: {
      format: apiDescription({}, { request: INSECURE }),
      respond: respondByScheme({
        https: { headers: setCookieLines([SECURE_COOKIE]) },
        http: { headers: setCookieLines([PLAIN_COOKIE]) },
      }),
    },
    skips: fallback.test,
  },
  // Recorded traffic is real: http://localhost:8080 is judged like any other
  // plain-http origin, never skipped.
  analytics: {
    violates: fallback.analytics,
    conforms: {
      transactions: [
        recorded({ headers: setCookieLines([SECURE_COOKIE]) }),
        recorded({ origin: INSECURE, headers: setCookieLines([PLAIN_COOKIE]) }),
      ],
    },
  },
} satisfies RuleFixtures;
