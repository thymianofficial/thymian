import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-evaluate-if-unmodified-since',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-Unmodified-Since header field without an If-Match header field, the origin server MUST evaluate the If-Unmodified-Since condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server MUST evaluate If-Unmodified-Since when If-Match is not present.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-unmodified-since', 'evaluation')
  .done();
