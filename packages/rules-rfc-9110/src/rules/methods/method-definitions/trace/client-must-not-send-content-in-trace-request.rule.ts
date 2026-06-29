import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

// Request-side rule: it constrains what the *client* sends in a TRACE request
// (no content allowed). `static` validates whether the OpenAPI description
// declares a TRACE request body; `analyze` validates recorded client requests.
// `test` is intentionally absent because Thymian is the sender there. Only
// request-body presence is needed, so the common projection is sufficient.
export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  // Request-side roles so the rule matches HAR requests (default 'user-agent').
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('TRACE'),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        if (!req.body) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A client MUST NOT send content in a TRACE request, but this TRACE request carries a message body.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
