import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response',
)
  .severity('hint')
  // Informational (#327): a permissive MAY about client timing (whether/when it
  // proceeds to send content). There is no non-conformant condition to detect,
  // and the timing of content transmission is not visible in a captured
  // request/response transaction. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that sends a 100-continue expectation is not required to wait for any specific length of time; such a client MAY proceed to send the content even if it has not yet received a response.',
  )
  .appliesTo('client')
  .done();
