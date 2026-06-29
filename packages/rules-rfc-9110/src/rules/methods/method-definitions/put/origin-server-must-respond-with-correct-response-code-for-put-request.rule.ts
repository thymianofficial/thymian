import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

const allowedSuccessStatusCodes = [200, 201, 204];

// Response-side / server-behavior rule on the status code only, so the common
// projection serves all three contexts: `static` over the described PUT
// success responses, `test` over the live response, and `analyze` over
// recorded responses. A successful PUT must complete with 200, 201 or 204; any
// other 2xx is a violation.
export default httpRule(
  'rfc9110/origin-server-must-respond-with-correct-response-code-for-put-request',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .summary(
    'Origin server MUST sending a 200 (OK), 201 (Created) or 204 (No Content) response, depending on whether a resource was created or updated.',
  )
  .description(
    'If the target resource does not have a current representation and the PUT successfully creates one, then the origin server MUST inform the user agent by sending a 201 (Created) response. If the target resource does have a current representation and that representation is successfully modified in accordance with the state of the enclosed representation, then the origin server MUST send either a 200 (OK) or a 204 (No Content) response to indicate successful completion of the request.',
  )
  .appliesTo('origin server')
  .rule((context) =>
    context.validateCommonHttpTransactions(
      and(method('PUT'), statusCodeRange(200, 299)),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        if (allowedSuccessStatusCodes.includes(res.statusCode)) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A successful PUT MUST return 201 (Created) when it creates a resource, or 200 (OK) / 204 (No Content) when it modifies one, but this response used ${res.statusCode}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
