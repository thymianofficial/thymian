import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-location-header-for-preferred-choice-for-300-response'
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-300-multiple-choices')
  .description(
    "If the server has a preferred choice, the server SHOULD generate a Location header field containing a preferred choice's URI reference."
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (_, res) => res.statusCode === 300,
      (_, res) =>
        res.headers.some((header) => header.toLowerCase() === 'location')
    )
  )
  .done();
