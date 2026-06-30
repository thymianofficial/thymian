import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

import { createList } from '../../../../utils.js';

// Security-relevant: a TRACE request is echoed back by the final recipient, so
// any sensitive field a client places in it can be disclosed in the response.
// This heuristic list flags the most common credential/secret-bearing header
// names. Only header *names* are needed (presence, not value), so the common
// projection is sufficient.
const sensitiveHeaders = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
];

export default httpRule(
  'rfc9110/client-must-not-generate-fields-containing-sensitive-data-in-trace-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'A client MUST NOT generate fields in a TRACE request containing sensitive data that might be disclosed by the response.',
  )
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('TRACE'),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        const present = sensitiveHeaders.filter((sensitive) =>
          req.headers.some((header) => header.toLowerCase() === sensitive),
        );

        if (present.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A TRACE request MUST NOT carry fields containing sensitive data, because the final recipient echoes the request back in the response. The following sensitive header field(s) are present: ${createList(
                present,
              )}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
