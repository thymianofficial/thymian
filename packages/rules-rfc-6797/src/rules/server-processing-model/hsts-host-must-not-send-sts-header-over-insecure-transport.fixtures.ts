import {
  apiDescription,
  FALLBACK,
  INSECURE,
  INSECURE_ORIGIN,
  recorded,
  respondWith,
  SECURE_ORIGIN,
  STS_ONE_YEAR,
  stsHeader,
} from '../../test/builders.js';
import { defineFixtures } from '../../test/harness.js';
import rule from './hsts-host-must-not-send-sts-header-over-insecure-transport.rule.js';

export default defineFixtures({
  rule,
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
        // The fallback scheme is Thymian's, not the document's
        // (thymianofficial/thymian-workspace#81).
        { request: FALLBACK, response: { headers: stsHeader() } },
      ),
    },
  },
  test: {
    violates: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
    conforms: {
      format: apiDescription({}, { request: FALLBACK }),
      respond: respondWith({ headers: STS_ONE_YEAR }),
    },
  },
  analytics: {
    violates: {
      transactions: [
        recorded({ origin: INSECURE_ORIGIN, headers: STS_ONE_YEAR }),
      ],
    },
    conforms: {
      transactions: [
        recorded({ origin: SECURE_ORIGIN, headers: STS_ONE_YEAR }),
        recorded({ origin: INSECURE_ORIGIN }),
      ],
    },
  },
});
