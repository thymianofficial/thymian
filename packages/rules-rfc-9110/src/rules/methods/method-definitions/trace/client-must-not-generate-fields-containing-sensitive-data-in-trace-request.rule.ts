import { httpRule, method, or, requestHeader } from '@thymian/core';

import { sensitiveHeaders } from './trace-sensitive-headers.js';

export default httpRule(
  'rfc9110/client-must-not-generate-fields-containing-sensitive-data-in-trace-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'A client MUST NOT generate fields in a TRACE request containing sensitive data that might be disclosed by the response.',
  )
  .explanation(
    'When your client issues a TRACE request, it must leave out any header fields that carry sensitive data, such as stored credentials or cookies. This matters because TRACE is a loop-back: the recipient reflects the request message straight back into the response body, so anything sensitive the client sends is echoed where it can be read, logged, or intercepted. Withholding those fields keeps secrets from being needlessly disclosed by the diagnostic response.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      method('TRACE'),
      or(...sensitiveHeaders.map((header) => requestHeader(header))),
    ),
  )
  .done();
