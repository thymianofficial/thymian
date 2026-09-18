import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-may-close-connection-for-413-response')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up signals the close on the wire as a Connection: close option on the 413, a field name even the value-blind common projection sees. The hint — a 413 that declines the content without taking the connection down — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'The server MAY terminate the request, if the protocol version in use allows it; otherwise, the server MAY close the connection.',
  )
  .appliesTo('server')
  .done();
