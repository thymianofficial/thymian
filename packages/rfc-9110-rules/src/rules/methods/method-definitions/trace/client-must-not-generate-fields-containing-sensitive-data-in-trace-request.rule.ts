import { method, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

// TODO: Add more headers
const sensitiveHeaders = ['Authorization', 'Proxy-Authorization', 'X-API-Key'];

export default httpRule(
  'rfc9110/client-must-not-generate-fields-containing-sensitive-data-in-trace-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'A client MUST NOT generate fields in a TRACE request containing sensitive data that might be disclosed by the response.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('TRACE'),
      or(...sensitiveHeaders.map((header) => requestHeader(header))),
    ),
  )
  .done();
