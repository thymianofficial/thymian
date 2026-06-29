import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-must-respond-immediately-to-100-continue-request',
)
  .severity('hint')
  // Informational (#327): a MUST about *immediacy* of the response to a
  // 100-continue request. Both the satisfying behaviours (immediate final
  // status OR immediate 100 Continue) are conformant, and the interim 100
  // Continue + its timing are not represented in a captured request/response
  // transaction. No detectable non-conformant case. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'Upon receiving an HTTP/1.1 (or later) request that has a method, target URI, and complete header section that contains a 100-continue expectation and an indication that request content will follow, an origin server MUST send either an immediate response with a final status code, or an immediate 100 (Continue) response.',
  )
  .appliesTo('origin server')
  .done();
