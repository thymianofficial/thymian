import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- precondition evaluation ordering, not a concern-axis topic
export default httpRule(
  'rfc9110/origin-server-must-evaluate-if-none-match-before-method',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Internal evaluation timing is not observable on the wire.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-None-Match header field, the origin server MUST evaluate the If-None-Match condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server MUST evaluate If-None-Match condition before performing the method.',
  )
  .explanation(
    'The externally checkable consequence — answering 304 or 412 when the condition fails — is actively probed by origin-server-must-respond-304-or-412-when-if-none-match-fails.',
  )
  .appliesTo('origin server')
  .done();
