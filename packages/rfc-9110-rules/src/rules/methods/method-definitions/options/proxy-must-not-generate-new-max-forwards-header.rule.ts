import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/proxy-must-not-generate-new-max-forwards-header',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A proxy MUST NOT generate a Max-Forwards header field while forwarding a request unless that request was received with a Max-Forwards field.',
  )
  .appliesTo('proxy')
  .done();
