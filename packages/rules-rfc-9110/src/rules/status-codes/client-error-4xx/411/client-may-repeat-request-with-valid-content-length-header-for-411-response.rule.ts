import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-repeat-request-with-valid-content-length-header-for-411-response',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A MAY describing an internal client retry decision; no non-conformant condition to observe.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-411-length-required')
  .description(
    'The client MAY repeat the request if it adds a valid Content-Length header field containing the length of the request content.',
  )
  .appliesTo('client')
  .done();
