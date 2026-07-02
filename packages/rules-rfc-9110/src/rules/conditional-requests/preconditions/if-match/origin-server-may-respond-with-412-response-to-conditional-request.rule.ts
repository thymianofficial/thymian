import { httpRule } from '@thymian/core';

/**
 * This is a permissive MAY: when an If-Match condition fails the origin server
 * *may* respond 412, but per the same section it may instead respond 2xx (when
 * the state-changing operation appears already applied). Because 412 is
 * permitted but not required, neither a 412 nor a non-412 response is by itself
 * a violation. The genuine, enforceable obligation — the server MUST NOT perform
 * the method when If-Match fails — is tested by
 * `origin-server-must-not-perform-method-when-if-match-fails`.
 */
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
