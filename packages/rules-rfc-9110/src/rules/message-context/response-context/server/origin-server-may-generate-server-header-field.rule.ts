import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-generate-server-header-field',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server MAY generate a Server header field in its responses.',
  )
  .appliesTo('origin server')
  .done();
