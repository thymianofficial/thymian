import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- a MAY/SHOULD permission that is neither the mitigation nor the hazard
export default httpRule(
  'rfc9110/origin-server-may-respond-with-412-response-to-unmodified-since',
)
  .severity('hint')
  .type(
    'informational',
    'only-origin-knows',
    "Reading a response as an exercise of this permission requires knowing the If-Unmodified-Since condition evaluated false, which turns on the selected representation's last modification date at the moment of evaluation — origin state that no request or response carries. Without it, a 412 cannot be told from a 412 sent for any other reason.",
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
