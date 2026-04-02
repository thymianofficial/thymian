import { and, method, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-evaluate-if-match-before-method',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-Match header field, the origin server MUST evaluate the If-Match condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server MUST evaluate If-Match condition before performing the method.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-match', 'evaluation')
  .done();
