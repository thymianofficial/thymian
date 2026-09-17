import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- a MAY/SHOULD permission that is neither the mitigation nor the hazard
export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY: 412 is permitted but not required, so neither a 412 nor a non-412 response is by itself a violation.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'An origin server that evaluates an If-Unmodified-Since condition MUST NOT perform the requested method if the condition evaluates to false. Instead, the origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .summary(
    'An origin server MAY indicate that the conditional request failed by responding with a 412 (Precondition Failed) status code.',
  )
  .explanation(
    'The genuine, enforceable obligation — MUST NOT perform the method when the condition fails — is tested by origin-server-must-not-perform-method-when-if-unmodified-since-fails.',
  )
  .appliesTo('origin server')
  .done();
