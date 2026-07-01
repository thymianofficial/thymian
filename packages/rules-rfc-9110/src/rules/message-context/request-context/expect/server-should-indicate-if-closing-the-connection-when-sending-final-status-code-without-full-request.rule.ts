import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/server-should-indicate-if-closing-the-connection-when-sending-final-status-code-without-full-request',
)
  .severity('warn')
  // Informational: the trigger ("responds before reading the entire request
  // content") is server-internal state not observable from the response, and
  // whether the connection was actually closed is transport-level; surfaced as
  // guidance only.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-expect')
  .description(
    'A server that responds with a final status code before reading the entire request content SHOULD indicate whether it intends to close the connection (e.g., see Section 9.6 of [HTTP/1.1]) or continue reading the request content.',
  )
  .appliesTo('server')
  .done();
