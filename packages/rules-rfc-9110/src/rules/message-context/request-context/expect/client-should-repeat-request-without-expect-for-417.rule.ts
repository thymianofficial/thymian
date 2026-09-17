import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-should-repeat-request-without-expect-for-417',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    "Whether a client's later request is a deliberate repeat of an earlier 417'd one is an internal client decision; nothing on the wire marks two requests as the same logical retry.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A client that receives a 417 (Expectation Failed) status code in response to a request containing a 100-continue expectation SHOULD repeat that request without a 100-continue expectation, since the 417 response merely indicates that the response chain does not support expectations.',
  )
  .appliesTo('client')
  .done();
