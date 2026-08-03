import { and, hasRequestBody, httpRule, method } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-generate-content-in-head-request',
)
  .severity('warn')
  .type('static', 'analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-head')
  .description(
    'A client SHOULD NOT generate content in a HEAD request unless it is made directly to an origin server that has previously indicated, in or out of band, that such a request has a purpose and will be adequately supported. ',
  )
  .summary('A client SHOULD NOT generate content in a HEAD request.')
  .explanation(
    'Your client should not attach a body to a HEAD request unless it is talking directly to an origin server that has confirmed such a body is meaningful and supported. Content in a HEAD has no standard meaning and cannot change what the request asks for. It matters for interoperability and safety: intermediaries may not forward the body, and some implementations reject the request or close the connection because an unexpected body looks like a request smuggling attack.',
  )
  .appliesTo('client')
  .rule((ctx) =>
    ctx.validateCommonHttpTransactions(and(method('HEAD'), hasRequestBody())),
  )
  .done();
