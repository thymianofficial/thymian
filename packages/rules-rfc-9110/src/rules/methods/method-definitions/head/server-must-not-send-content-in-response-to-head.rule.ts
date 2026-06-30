import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

export default httpRule(
  'rfc9110/server-must-not-send-content-in-response-to-head',
)
  .severity('error')
  .type('static', 'analytics', 'test')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'The HEAD method is identical to GET except that the server MUST NOT send content in the response.',
  )
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
