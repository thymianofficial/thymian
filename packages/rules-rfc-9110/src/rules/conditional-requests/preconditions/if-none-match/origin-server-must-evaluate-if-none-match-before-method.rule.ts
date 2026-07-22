import { httpRule } from '@thymian/core';

/**
 * This MUST is about internal evaluation timing (check If-None-Match before
 * performing the method), which is not observable on the wire. Its externally
 * checkable consequence — answering 304 or 412 when the condition fails — is
 * actively probed by
 * `origin-server-must-respond-304-or-412-when-if-none-match-fails`.
 */
export default httpRule(
  'rfc9110/origin-server-must-evaluate-if-none-match-before-method',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-None-Match header field, the origin server MUST evaluate the If-None-Match condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server MUST evaluate If-None-Match condition before performing the method.',
  )
  .appliesTo('origin server')
  .done();
