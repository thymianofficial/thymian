import {
  type CommonHttpRequest,
  type CommonHttpResponse,
  httpRule,
  method,
} from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-generate-content-in-head-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'A client SHOULD NOT generate content in a HEAD request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported. ',
  )
  .summary('A client SHOULD NOT generate content in a HEAD request.')
  .appliesTo('client', 'user-agent')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('HEAD'),
      (req: CommonHttpRequest, _res: CommonHttpResponse, location) => {
        if (!req.body) {
          return [];
        }

        return [
          {
            location,
            violation: {
              message:
                'A client SHOULD NOT generate content in a HEAD request unless the target origin server has indicated it is supported; this HEAD request carries content.',
            },
            findings: [],
          },
        ];
      },
    ),
  )
  .done();
