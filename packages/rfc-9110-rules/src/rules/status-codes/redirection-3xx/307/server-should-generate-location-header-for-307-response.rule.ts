import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-location-header-for-307-response',
)
  .severity('warn')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-307-temporary-redirect',
  )
  .description(
    'The server SHOULD generate a Location header field in the response containing a URI reference for the different URI.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(307),
      not(responseHeader('location')),
    ),
  )
  .done();
