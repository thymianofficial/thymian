import { hasRequestBody, httpRule, method } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-generate-content-for-delete-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-delete')
  .description(
    'A client SHOULD NOT generate content in a DELETE request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported.',
  )
  .explanation(
    'Your client should not put a body on a DELETE request unless it is talking directly to an origin server that has confirmed the body is meaningful and supported. Content in a DELETE has no standard meaning and cannot change what gets deleted. It matters for interoperability and safety: intermediaries may not forward the body, and some implementations reject or drop the connection because an unexpected body looks like a request smuggling attack.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(method('DELETE'), hasRequestBody()),
  )
  .done();
