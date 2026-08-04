import { hasRequestBody, httpRule, method } from '@thymian/core';

export default httpRule('rfc9110/client-must-not-send-content-in-trace-request')
  .severity('error')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description('A client MUST NOT send content in a TRACE request.')
  .explanation(
    'Your client must not attach a body to a TRACE request. This matters because TRACE exists purely to reflect the request message back for diagnostics; a request body has no defined meaning here and would only invite ambiguity in how intermediaries handle the message. Keeping TRACE requests bodyless ensures every recipient interprets the loop-back consistently.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('TRACE'), hasRequestBody()),
  )
  .done();
