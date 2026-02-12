import { httpRule } from '@thymian/http-linter';

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
  .tags('conditional-requests', 'if-none-match', 'evaluation')
  .done();
