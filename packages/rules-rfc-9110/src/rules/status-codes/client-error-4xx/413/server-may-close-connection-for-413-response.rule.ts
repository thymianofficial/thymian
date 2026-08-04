import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-close-connection-for-413-response')
  .severity('hint')
  // Permissive MAY about closing the underlying connection. Connection-level
  // behavior is not represented in request/response transactions.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'The server MAY terminate the request, if the protocol version in use allows it; otherwise, the server MAY close the connection.',
  )
  .appliesTo('server')
  .done();
