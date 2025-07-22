import { equalsIgnoreCase, httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-location-header-for-302-response'
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-302-found')
  .description(
    'The server SHOULD generate a Location header field in the response containing a URI reference for the different URI.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      (req, res) => res.statusCode === 302,
      (req, res) => !equalsIgnoreCase('location', ...res.headers)
    )
  )
  .done();
