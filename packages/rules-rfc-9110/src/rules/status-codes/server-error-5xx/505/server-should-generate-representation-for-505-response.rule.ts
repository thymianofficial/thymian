import { hasResponseBody, not, statusCode } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-generate-representation-for-505-response',
)
  .severity('warn')
  .type('static', 'analytics', 'test')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-505-http-version-not-suppor',
  )
  .description(
    'The server SHOULD generate a representation for the 505 response that describes why that version is not supported and what other protocols are supported by that server.',
  )
  .explanation(
    "When you return a 505 (HTTP Version Not Supported) because you cannot or will not handle the request's HTTP major version, include a response body that explains why that version is not supported and which protocol versions you do support. This matters because the client otherwise only learns that something failed, with no way to know how to succeed; a clear explanation lets the client (or a developer debugging it) retry with a supported version instead of guessing.",
  )
  .appliesTo('server')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(statusCode(505), not(hasResponseBody())),
  )
  .done();
