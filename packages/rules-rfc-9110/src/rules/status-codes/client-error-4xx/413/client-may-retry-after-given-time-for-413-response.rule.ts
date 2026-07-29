import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-retry-after-given-time-for-413-response',
)
  .severity('hint')
  // Permissive MAY describing an internal client retry decision; no
  // non-conformant condition to observe.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'If the condition is temporary, the server should generate a Retry-After header field to indicate that it is temporary and after what time the client MAY try again.',
  )
  .appliesTo('client')
  .done();
