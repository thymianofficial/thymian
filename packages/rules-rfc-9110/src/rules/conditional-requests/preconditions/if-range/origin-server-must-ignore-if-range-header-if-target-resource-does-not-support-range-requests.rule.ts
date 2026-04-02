import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'An origin server MUST ignore an If-Range header field received in a request for a target resource that does not support Range requests.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
