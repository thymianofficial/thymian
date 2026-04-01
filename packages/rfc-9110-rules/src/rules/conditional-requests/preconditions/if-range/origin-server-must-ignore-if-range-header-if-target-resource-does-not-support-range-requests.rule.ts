import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-must-evaluate-if-range')
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'origin-server-must-ignore-if-range-header-if-target-resource-does-not-support-range-requests.',
  )
  .appliesTo('origin server')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
