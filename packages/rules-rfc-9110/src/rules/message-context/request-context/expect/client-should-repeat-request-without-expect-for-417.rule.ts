import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-repeat-request-without-expect-for-417',
)
  .severity('hint')
  // Correlating a 417 response to a later retried request from the same client
  // requires cross-message client-behaviour correlation that is not available.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that receives a 417 (Expectation Failed) status code in response to a request containing a 100-continue expectation SHOULD repeat that request without a 100-continue expectation, since the 417 response merely indicates that the response chain does not support expectations.',
  )
  .appliesTo('client')
  .done();
