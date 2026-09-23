import {
  apiDescription,
  FALLBACK,
  header,
  INSECURE,
  INSECURE_ORIGIN,
  recorded,
  respondWith,
} from '../../test/builders.js';
import { defineFixtures } from '../../test/harness.js';
import rule from './hsts-host-should-redirect-insecure-requests-to-https.rule.js';

const toHttps = { location: 'https://api.example.com/' };

export default defineFixtures({
  rule,
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
          response: {
            statusCode: 301,
            headers: header('location', toHttps.location),
          },
        },
        // The fallback scheme is Thymian's, not the document's
        // (thymianofficial/thymian-workspace#81).
        { request: FALLBACK, response: { statusCode: 200 } },
      ),
    },
  },
  // The description declares 200 and the server answers with a redirect in
  // both cases — a status the description does not declare, which reaches
  // the rule only because it opts out of the status-code check. A temporary
  // redirect is re-requested over plain HTTP every time.
  test: {
    violates: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ statusCode: 302, headers: toHttps }),
    },
    conforms: {
      format: apiDescription({ request: INSECURE }),
      respond: respondWith({ statusCode: 301, headers: toHttps }),
    },
  },
  analytics: {
    violates: {
      transactions: [
        recorded({
          origin: INSECURE_ORIGIN,
          statusCode: 302,
          headers: toHttps,
        }),
      ],
    },
    conforms: {
      transactions: [
        recorded({
          origin: INSECURE_ORIGIN,
          statusCode: 308,
          headers: toHttps,
        }),
      ],
    },
  },
});
