import {
  and,
  type CommonHttpResponse,
  requestHeader,
  statusCode,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

function hasHeader(headers: string[], name: string): boolean {
  return headers.some((header) => header.toLowerCase() === name);
}

export default httpRule(
  'rfc9110/server-should-send-content-range-in-416-response',
)
  .severity('warn')
  // Implementable (outcome 1): a response-side, server-behavior check. The
  // condition — a 416 response to a request that carried a Range header but
  // whose response omits Content-Range — is fully observable from header
  // presence and status, so the common projection (header NAMES only) is
  // sufficient. Meaningful in both `test` (Thymian observes the response) and
  // `analyze`. Header presence is matched case-insensitively.
  .type('analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-content-range')
  .description(
    'A server generating a 416 (Range Not Satisfiable) response to a byte-range request SHOULD send a Content-Range header field with an unsatisfied-range value. The complete-length in a 416 response indicates the current length of the selected representation.',
  )
  .summary(
    'Server should send Content-Range with unsatisfied-range in 416 responses.',
  )
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(statusCode(416), requestHeader('range')),
      (_req, res: CommonHttpResponse, location) => {
        if (hasHeader(res.headers, 'content-range')) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A 416 (Range Not Satisfiable) response to a request carrying a Range header omits the Content-Range header field. The server SHOULD send Content-Range with an unsatisfied-range value (complete-length) so the client learns the current representation length.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
