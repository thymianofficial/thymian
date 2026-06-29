import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

// Request-side rule: it constrains what the *client* puts in a DELETE request.
// `static` validates whether the OpenAPI description declares a request body
// for DELETE operations; `analyze` validates request bodies in recorded client
// traffic. `test` is intentionally absent — in `test` Thymian is the sender,
// so the presence of request content is not under user control and the rule
// could not meaningfully apply. Only request-body *presence* is needed, so the
// common projection is sufficient and the same check serves both contexts.
export default httpRule(
  'rfc9110/client-should-not-generate-content-for-delete-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported.',
  )
  // Request-side roles so the rule matches HAR requests (default role
  // 'user-agent') as well as a generic 'client'.
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('DELETE'),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        if (!req.body) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A client SHOULD NOT generate content in a DELETE request unless the target origin server has indicated it is supported; this DELETE request carries content.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
