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

// Response-side / server-behavior rule operating on response header *names*
// only, so the common projection is sufficient and the same check runs in both
// declared contexts. `static` validates the 2xx CONNECT response declared in
// the OpenAPI description; `analyze` validates recorded responses. `test` is
// intentionally omitted: Thymian generates requests from the spec and does not
// open CONNECT tunnels, so it cannot exercise this response live.
export default httpRule(
  'rfc9110/server-must-not-send-transfer-encoding-or-content-length-headers-in-2xx-response-to-connect-request',
)
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A server MUST NOT send any Transfer-Encoding or Content-Length header fields in a 2xx (Successful) response to CONNECT.',
  )
  // 'origin server' is included so the rule fires on HAR responses, whose
  // default response role is 'origin server'.
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
