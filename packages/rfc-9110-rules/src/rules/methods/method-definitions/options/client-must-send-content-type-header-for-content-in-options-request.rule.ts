import { and, hasRequestBody, method, not, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-must-send-content-type-header-for-content-in-options-request',
)
  .severity('error')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client that generates an OPTIONS request containing content MUST send a valid Content-Type header field describing the representation media type.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(
      and(method('OPTIONS'), hasRequestBody()),
      not(requestHeader('content-type')),
    ),
  )
  .done();
