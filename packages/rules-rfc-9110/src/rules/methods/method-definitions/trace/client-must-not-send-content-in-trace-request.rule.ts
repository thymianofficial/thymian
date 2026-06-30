import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
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
