import { not, responseHeader, statusCode } from '@thymian/http-filter';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-should-generate-location-header-for-308-response'
)
  .severity('warn')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-308-permanent-redirect'
  )
  .description(
    'The server SHOULD generate a Location header field in the response containing a preferred URI reference for the new permanent URI.'
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(308),
      not(responseHeader('location'))
    )
  )
  .done();
