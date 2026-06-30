import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-may-respond-with-417-response-for-other-expect-than-100-continue',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that receives an Expect field value containing a member other than 100-continue MAY respond with a 417 (Expectation Failed) status code to indicate that the unexpected expectation cannot be met.',
  )
  .appliesTo('server')
  .done();
