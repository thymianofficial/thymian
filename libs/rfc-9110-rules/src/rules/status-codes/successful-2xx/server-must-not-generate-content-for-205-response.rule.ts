import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-must-not-generate-content-for-205-response'
)
  .severity('error')
  .type('test', 'static', 'analytics')
  .appliesTo('origin server')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-205-reset-content')
  .description(
    `In 200 responses to GET or HEAD, an origin server SHOULD send any available validator fields for the selected representation, with both a strong entity tag and a Last-Modified date being preferred.`
  )
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (_, res) => res.statusCode === 205,
      (_, res) => res.body
    )
  )
  .done();
