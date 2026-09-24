import {
  apiDescription,
  FALLBACK,
  header,
  INSECURE,
  recorded,
  respondByScheme,
  respondWith,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './hsts-host-should-redirect-insecure-requests-to-https.rule.js';

const TO_HTTPS = 'https://api.example.com/';
const toHttps = { location: TO_HTTPS };

export default {
  rule,
  // A declared http://api.example.com is judged, and an operation served
  // over https is not; http://localhost:8080 is what a document with no
  // usable server URL loads as, so the rule skips it.
  static: {
    violates: {
      format: apiDescription({
        request: INSECURE,
        response: { statusCode: 200 },
      }),
    },
    conforms: {
      format: apiDescription(
        {
          request: INSECURE,
          response: { statusCode: 301, headers: header('location', TO_HTTPS) },
        },
        { response: { statusCode: 200 } },
      ),
    },
    skips: {
      format: apiDescription({
        request: FALLBACK,
        response: { statusCode: 200 },
      }),
    },
  },
  // Every description declares 200, and the server answers with a redirect:
  // a status the description does not declare, which reaches the rule only
  // because it opts out of the status-code check. Without the opt-out the
  // violating 302 is skipped before the rule sees it, and the suite fails.
  test: {
    violates: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ statusCode: 302, headers: toHttps }),
    },
    conforms: {
      format: apiDescription({ request: INSECURE }, {}),
      respond: respondByScheme({
        http: { statusCode: 301, headers: toHttps },
        https: {},
      }),
    },
    skips: {
      format: apiDescription({ request: FALLBACK }),
      respond: respondWith({}),
    },
  },
  // Recorded traffic is real: http://localhost:8080 is judged like any other
  // origin, never skipped.
  analytics: {
    violates: { transactions: [recorded({ origin: FALLBACK })] },
    conforms: {
      transactions: [
        recorded({ origin: INSECURE, statusCode: 308, headers: toHttps }),
        recorded({}),
      ],
    },
  },
} satisfies RuleFixtures;
