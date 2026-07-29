import { not, responseHeader, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-content-range-header-for-416-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-416-range-not-satisfiable',
  )
  .description(
    'A server that generates a 416 response to a byte-range request SHOULD generate a Content-Range header field specifying the current length of the selected representation.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      statusCode(416),
      not(responseHeader('content-range')),
    ),
  )
  .done();
