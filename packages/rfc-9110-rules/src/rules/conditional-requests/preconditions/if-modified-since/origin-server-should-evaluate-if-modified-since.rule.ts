import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-evaluate-if-modified-since',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    'When an origin server receives a request that selects a representation and that request includes an If-Modified-Since header field without an If-None-Match header field, the origin server SHOULD evaluate the If-Modified-Since condition per Section 13.2 prior to performing the method.',
  )
  .summary(
    'Origin server SHOULD evaluate If-Modified-Since when If-None-Match is not present.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
