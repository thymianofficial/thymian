import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/gateway-may-send-via-header-in-responses')
  .severity('hint')
  // Informational (outcome 2): sending Via in forwarded *responses* is an
  // explicit permission (MAY) for gateways — its absence is not a violation.
  // The previous implementation flagged every gateway response that lacked a
  // Via header as a finding, which inverts the MAY into a requirement. There is
  // no non-conformant condition to detect, so the rule is reclassified to
  // informational. (Contrast the request-side `gateway-must-send-via-header-in-
  // inbound-requests`, which is a genuine MUST and remains enforced.)
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An HTTP-to-HTTP gateway MAY send a Via header field in forwarded response messages. This is optional for responses, unlike requests where it is required.',
  )
  .summary('Gateway MAY send Via header in forwarded responses.')
  .appliesTo('gateway')
  .done();
