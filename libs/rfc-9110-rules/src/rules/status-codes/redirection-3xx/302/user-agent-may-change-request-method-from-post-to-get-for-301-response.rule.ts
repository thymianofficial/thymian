import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-change-request-method-from-post-to-get-for-301-response'
)
  .severity('hint')
  .type('static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-302-found')
  .summary(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request.'
  )
  .description(
    'For historical reasons, a user agent MAY change the request method from POST to GET for the subsequent request. If this behavior is undesired, the 307 (Temporary Redirect) status code can be used instead.'
  )
  .appliesTo('user-agent')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      (_, res) => res.statusCode === 302,
      (req) => {
        const getReq = ctx.format.findNode('http-request', {
          host: req.host,
          path: req.path,
          port: req.port,
          method: 'get',
          mediaType: req.mediaType,
          protocol: req.protocol,
        });

        return typeof getReq === 'undefined';
      }
    )
  )
  .done();
