import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-content-for-300-response'
)
  .severity('warn')
  .type('analytics', 'static')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    'For request methods other than HEAD, the server SHOULD generate content in the 300 response containing a list of representation metadata and URI reference(s) from which the user or user agent can choose the one most preferred.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (req, res) =>
        ctx.equalsIgnoreCase(req.method, 'head') && res.statusCode === 300,
      (_, res) => !res.body
    )
  )
  .done();
