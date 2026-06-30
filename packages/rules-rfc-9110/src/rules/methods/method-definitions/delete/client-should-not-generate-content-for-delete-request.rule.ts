import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-generate-content-for-delete-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported.',
  )
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
