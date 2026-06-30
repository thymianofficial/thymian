import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-send-max-forwards-header-in-option-request',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-options')
  .description(
    'A client MAY send a Max-Forwards header field in an OPTIONS request to target a specific recipient in the request chain.',
  )
  .appliesTo('client')
  .done();
