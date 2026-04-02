import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-sever-must-generate-allow-header-for-405-response',
)
  .severity('error')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-405-method-not-allowed',
  )
  .description(
    "The origin server MUST generate an Allow header field in a 405 response containing a list of the target resource's currently supported methods.",
  )
  .appliesTo('origin server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(405),
      not(responseHeader('allow')),
    ),
  )
  .done();
