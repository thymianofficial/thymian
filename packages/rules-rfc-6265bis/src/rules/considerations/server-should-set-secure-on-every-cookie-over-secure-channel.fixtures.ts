import {
  apiDescription,
  FALLBACK,
  INSECURE,
  recorded,
  respondByScheme,
  setCookieHeader,
  setCookieInputs,
  setCookieInputsAt,
  setCookieLines,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './server-should-set-secure-on-every-cookie-over-secure-channel.rule.js';

const SECURE_COOKIE = 'SID=31d4d96e407aad42; Secure';
const PLAIN_COOKIE = 'SID=31d4d96e407aad42';

const violating = setCookieInputs(PLAIN_COOKIE);
// http://localhost:8080 is what a document with no usable server URL loads
// as, so its scheme may be Thymian's rather than the API's.
const fallback = setCookieInputsAt(FALLBACK, [PLAIN_COOKIE]);

// A Secure cookie over https, and a cookie without Secure over plain http,
// which the https-only rules judge: the scheme and the cookie together.
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
  // Recorded traffic is real: http://localhost:8080 is plain http, judged
  // like any other.
  analytics: {
    violates: violating.analytics,
    conforms: {
      transactions: [
        recorded({ headers: setCookieLines([SECURE_COOKIE]) }),
        recorded({
          origin: FALLBACK,
          headers: setCookieLines([PLAIN_COOKIE]),
        }),
      ],
    },
  },
} satisfies RuleFixtures;
