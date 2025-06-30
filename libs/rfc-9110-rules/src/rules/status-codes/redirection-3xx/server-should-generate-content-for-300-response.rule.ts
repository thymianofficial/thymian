import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-content-for-300-response'
)
  .severity('warn')
  .type('analytics', 'static')
  .url(
    'https://datatracker.ietf.org/doc/html/rfc9110#name-300-multiple-choices'
  )
  .description(
    'For request methods other than HEAD, the server SHOULD generate content in the 300 response containing a list of representation metadata and URI reference(s) from which the user or user agent can choose the one most preferred.'
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (_, res) => res.statusCode === 300,
      (_, res) => !res.body
    )
  )
  .done();
