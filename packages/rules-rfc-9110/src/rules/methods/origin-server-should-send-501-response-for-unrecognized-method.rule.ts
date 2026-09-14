import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-send-501-response-for-unrecognized-method',
)
  .severity('warn')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#110',
    'Provoking this needs a request using a genuinely unrecognized method; Thymian generates requests from the spec (only methods the API declares), so it never naturally produces one to observe the 501 response for.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-overview')
  .description(
    'An origin server that receives a request method that is unrecognized or not implemented SHOULD respond with the 501 (Not Implemented) status code.',
  )
  .appliesTo('origin server')
  .done();
