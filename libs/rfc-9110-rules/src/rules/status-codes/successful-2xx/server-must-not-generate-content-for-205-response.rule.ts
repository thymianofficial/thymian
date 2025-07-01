import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-generate-content-for-205-response'
)
  .severity('error')
  .type('test', 'static', 'analytics')
  .appliesTo('origin server')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-205-reset-content')
  .description(
    `Since the 205 status code implies that no additional content will be provided, a server MUST NOT generate content in a 205 response.`
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (_, res) => res.statusCode === 205,
      (_, res) => res.body
    )
  )
  .done();
