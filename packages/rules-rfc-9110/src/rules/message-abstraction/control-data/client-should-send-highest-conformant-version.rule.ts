import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/client-should-send-highest-conformant-version')
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    '"Highest conformant version" depends on internal client and server capabilities not observable from a transaction.',
  )
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A client SHOULD send a request version equal to the highest version to which the client is conformant and whose major version is no higher than the highest version supported by the server, if this is known.',
  )
  .summary(
    'Clients SHOULD send highest conformant HTTP version supported by server.',
  )
  .done();
