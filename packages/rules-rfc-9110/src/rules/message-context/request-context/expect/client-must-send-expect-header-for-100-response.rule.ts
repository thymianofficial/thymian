import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-send-expect-header-for-100-response',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that will wait for a 100 (Continue) response before sending the request content MUST send an Expect header field containing a 100-continue expectation.',
  )
  .appliesTo('client')
  .done();
