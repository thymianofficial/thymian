import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-send-expect-header-for-100-response',
)
  .severity('error')
  // Informational (#327): the requirement is conditioned on internal client
  // intent ("a client that *will wait* for 100 Continue"). Whether a client
  // intends to wait is not observable from a request, so there is no detectable
  // non-conformant case. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that will wait for a 100 (Continue) response before sending the request content MUST send an Expect header field containing a 100-continue expectation.',
  )
  .appliesTo('client')
  .done();
