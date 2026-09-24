import {
  apiDescription,
  FALLBACK,
  INSECURE,
  recorded,
  respondByScheme,
  respondWith,
  STS_ONE_YEAR,
  stsHeader,
} from '../../test/builders.js';
import type { RuleFixtures } from '../../test/harness.js';
import rule from './hsts-host-must-not-send-sts-header-over-insecure-transport.rule.js';

// The header over https, and a plain-http response without it: judged on
// the scheme and the header together.
const conformingServer = respondByScheme({
  https: { headers: STS_ONE_YEAR },
  http: {},
});

export default {
  rule,
  // A declared http://api.example.com is judged; http://localhost:8080 is
  // what a document with no usable server URL loads as, so its scheme may be
  // Thymian's rather than the API's, and the rule skips it.
  static: {
    violates: {
      format: apiDescription({
        request: INSECURE,
        response: { headers: stsHeader() },
      }),
    },
    conforms: {
      format: apiDescription(
        { response: { headers: stsHeader() } },
        { request: INSECURE },
      ),
    },
    skips: {
      format: apiDescription({
        request: FALLBACK,
        response: { headers: stsHeader() },
      }),
    },
  },
  // The recorded request carries the described origin, so the same fallback
  // reaches `test`.
  test: {
    violates: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
    conforms: {
      format: apiDescription({}, { request: INSECURE }),
      respond: conformingServer,
    },
    skips: {
      format: apiDescription({ request: FALLBACK }),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
  },
  // Recorded traffic is real: http://localhost:8080 is judged like any other
  // origin, never skipped.
  analytics: {
    violates: {
      transactions: [recorded({ origin: FALLBACK, headers: STS_ONE_YEAR })],
    },
    conforms: {
      transactions: [
        recorded({ headers: STS_ONE_YEAR }),
        recorded({ origin: INSECURE }),
      ],
    },
  },
} satisfies RuleFixtures;
