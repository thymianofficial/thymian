import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/accept-ranges-may-be-sent-in-trailer')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-accept-ranges')
  .description(
    'The Accept-Ranges field MAY be sent in a trailer section, but is preferred to be sent as a header field because the information is particularly useful for restarting large information transfers that have failed in mid-content (before the trailer section is received).',
  )
  .summary(
    'Accept-Ranges may be sent in trailer but header field is preferred for failed transfer recovery.',
  )
  .appliesTo('origin server')
  .done();
