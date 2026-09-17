import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- precondition evaluation ordering, not a concern-axis topic
export default httpRule(
  'rfc9110/origin-server-must-evaluate-if-unmodified-since',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'Internal evaluation timing is not observable on the wire.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-Unmodified-Since header field without an If-Match header field, the origin server MUST evaluate the If-Unmodified-Since condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server MUST evaluate If-Unmodified-Since when If-Match is not present.',
  )
  .explanation(
    'The externally checkable consequence — declining the method when the condition fails — is actively probed by origin-server-must-not-perform-method-when-if-unmodified-since-fails.',
  )
  .appliesTo('origin server')
  .done();
