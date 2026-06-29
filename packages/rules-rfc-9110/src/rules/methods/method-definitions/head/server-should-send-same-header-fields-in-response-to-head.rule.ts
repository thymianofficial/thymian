import { equalsIgnoreCase } from '@thymian/core';
import { and, method, or, statusCode, url } from '@thymian/core';
import { httpRule } from '@thymian/core';

import { arrayDifference, createList } from '../../../../utils.js';

// Response-side / server-behavior rule. It pairs a GET and a HEAD response for
// the same URL and compares response header *names* (the common projection is
// sufficient). The same grouped-common check serves all three contexts:
// `static` over described responses, `test` over live GET/HEAD pairs, and
// `analyze` over recorded pairs.
export default httpRule(
  'rfc9110/server-should-send-same-header-fields-in-response-to-head',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The server SHOULD send the same header fields in response to a HEAD request as it would have sent if the request method had been GET.',
  )
  // 'origin server' is included so the rule fires on HAR responses.
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateGroupedCommonHttpTransactions(
      and(statusCode(200), or(method('GET'), method('HEAD'))),
      url(),
      (_, transactions) => {
        const [, getResponse, getLocation] =
          transactions.find(([req]) => equalsIgnoreCase(req.method, 'get')) ??
          [];

        const [, headResponse, headLocation] =
          transactions.find(([req]) => equalsIgnoreCase(req.method, 'head')) ??
          [];

        if (!getResponse || !headResponse || !getLocation || !headLocation) {
          return [];
        }

        const difference = arrayDifference(
          getResponse.headers,
          headResponse.headers,
        );

        if (difference.length === 0) {
          return [];
        }

        return [
          {
            location: headLocation,
            violation: {
              message: `Response to HEAD request is missing headers: ${createList(difference)}`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
