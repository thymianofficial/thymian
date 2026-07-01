import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/gateway-may-send-via-header-in-responses')
  .severity('hint')
  // Informational: permissive MAY — a gateway adding Via to responses is optional, so its presence or absence is never a violation.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An HTTP-to-HTTP gateway MAY send a Via header field in forwarded response messages. This is optional for responses, unlike requests where it is required.',
  )
  .summary('Gateway MAY send Via header in forwarded responses.')
  .appliesTo('gateway')
  .done();
