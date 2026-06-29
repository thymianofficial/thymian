import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-omit-sending-100-response-if-already-received-content',
)
  .severity('hint')
  // Informational (#327): a permissive MAY (server may skip the 100 Continue).
  // No non-conformant condition, and the interim response is not represented in
  // a captured request/response transaction. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server MAY omit sending a 100 (Continue) response if it has already received some or all of the content for the corresponding request, or if the framing indicates that there is no content.',
  )
  .appliesTo('server')
  .done();
