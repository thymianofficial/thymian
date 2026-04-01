import { hasResponseBody, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-representation-for-505-response',
)
  .severity('warn')
  .type('static', 'analytics')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-505-http-version-not-suppor',
  )
  .description(
    'The server SHOULD generate a representation for the 505 response that describes why that version is not supported and what other protocols are supported by that server.',
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(505), not(hasResponseBody())),
  )
  .done();
