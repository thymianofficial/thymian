import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-repeat-request-with-valid-content-length-header-for-411-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up repeats the request with a Content-Length field the rejected one lacked, and even the name-only common projection sees that field appear on the second transaction. The hint — a 411 that was never followed by a repeat carrying Content-Length — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-411-length-required')
  .description(
    'The client MAY repeat the request if it adds a valid Content-Length header field containing the length of the request content.',
  )
  .appliesTo('client')
  .done();
