import { httpRule } from '@thymian/core';

/**
 * Permissive MAY: when an If-Unmodified-Since condition fails the origin server
 * *may* respond 412, but it may instead respond 2xx (when the state-changing
 * operation appears already applied). Because 412 is permitted but not required,
 * neither a 412 nor a non-412 response is by itself a violation. The genuine,
 * enforceable obligation — the server MUST NOT perform the method when the
 * condition fails — is tested by
 * `origin-server-must-not-perform-method-when-if-unmodified-since-fails`.
 */
export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .summary(
    'An origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .appliesTo('origin server')
  .tags(
    'conditional-requests',
    'if-unmodified-since',
    '412',
    'precondition-failed',
  )
  .done();
