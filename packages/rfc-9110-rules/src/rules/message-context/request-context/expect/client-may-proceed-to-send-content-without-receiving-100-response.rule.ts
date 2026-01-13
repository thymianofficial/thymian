import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-may-proceed-to-send-content-without-receiving-100-response',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that sends a 100-continue expectation is not required to wait for any specific length of time; such a client MAY proceed to send the content even if it has not yet received a response.',
  )
  .appliesTo('client')
  .done();
