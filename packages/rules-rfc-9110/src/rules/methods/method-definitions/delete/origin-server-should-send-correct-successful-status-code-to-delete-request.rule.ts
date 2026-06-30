import {
  and,
  type CommonHttpRequest,
  type CommonHttpResponse,
  method,
  statusCodeRange,
} from '@thymian/core';
import { httpRule } from '@thymian/core';

const expectedStatusCodes = [200, 202, 204];

export default httpRule(
  'rfc9110/origin-server-should-send-correct-successful-status-code-to-delete-request',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'If a DELETE method is successfully applied, the origin server SHOULD send 202 (Accepted), 204 (No Content) or 200 (OK).',
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('DELETE'), statusCodeRange(200, 299)),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        if (expectedStatusCodes.includes(res.statusCode)) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message: `A successfully applied DELETE SHOULD return 200 (OK), 202 (Accepted) or 204 (No Content), but this response used ${res.statusCode}.`,
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
