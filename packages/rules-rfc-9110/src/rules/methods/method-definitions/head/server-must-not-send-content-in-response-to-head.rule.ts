import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

// Response-side / server-behavior rule: the server MUST NOT send content in a
// response to HEAD. Only response-body *presence* is needed, so the common
// projection (`res.body`) serves all three contexts: `static` checks whether
// the OpenAPI description declares a response body/schema for HEAD operations,
// `test` checks the live HEAD response, and `analyze` checks recorded HEAD
// responses (default HAR response role 'origin server' matches appliesTo).
//
// NOTE: the previous implementation checked `hasRequestBody()` on the HEAD
// *request*, which is unrelated to this rule (and overlapped the separate
// "client should not generate content in HEAD request" rule). It has been
// corrected to inspect the response body.
export default httpRule(
  'rfc9110/server-must-not-send-content-in-response-to-head',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The HEAD method is identical to GET except that the server MUST NOT send content in the response.',
  )
  // 'origin server' is included so the rule fires on HAR responses.
  .appliesTo('server', 'origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('HEAD'),
      (_req: CommonHttpRequest, res: CommonHttpResponse, location) => {
        if (!res.body) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'The server MUST NOT send content in a response to HEAD, but this HEAD response carries a message body.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
