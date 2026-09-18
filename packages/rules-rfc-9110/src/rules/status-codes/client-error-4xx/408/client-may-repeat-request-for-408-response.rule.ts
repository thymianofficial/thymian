import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/client-may-repeat-request-for-408-response')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up sends the same request again after the 408, which a captured trace carries as a second transaction with the same method and target. The hint — a request timeout that was never retried — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-408-request-timeout')
  .description(
    'If the client has an outstanding request in transit, it MAY repeat that request.',
  )
  .appliesTo('client')
  .done();
