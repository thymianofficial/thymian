import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

import { createList } from '../../../../utils.js';

const forbiddenHeaders = ['transfer-encoding', 'content-length'];

function presentForbiddenHeaders(headers: string[]): string[] {
  return forbiddenHeaders.filter((forbidden) =>
    headers.some((header) => header.toLowerCase() === forbidden),
  );
}

export default httpRule(
  'rfc9110/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A server MUST NOT send any Transfer-Encoding or Content-Length header fields in a 2xx (Successful) response to CONNECT.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('CONNECT'), statusCodeRange(200, 299)),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        const present = presentForbiddenHeaders(res.headers);

        if (present.length === 0) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A 2xx (Successful) response to CONNECT MUST NOT carry ${createList(
                present,
              )}, because after a successful CONNECT the connection becomes a tunnel and these framing header fields are meaningless.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
