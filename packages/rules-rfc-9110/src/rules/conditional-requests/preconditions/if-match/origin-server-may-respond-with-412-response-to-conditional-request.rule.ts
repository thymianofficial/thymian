import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-conditional-request',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .summary(
    'An origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', '412', 'precondition-failed')
  .done();
