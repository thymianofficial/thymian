import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-omit-sending-100-response-if-already-received-content',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server MAY omit sending a 100 (Continue) response if it has already received some or all of the content for the corresponding request, or if the framing indicates that there is no content.',
  )
  .appliesTo('server')
  .done();
