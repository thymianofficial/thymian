import { httpRule } from '@thymian/core';

// This MUST governs internal client behavior — how the client interprets
// (ignores) Content-Length / Transfer-Encoding on a successful CONNECT
// response. "Ignoring" a header is an internal processing decision that leaves
// no trace on the wire, so it cannot be observed from a response, from recorded
// traffic, or by testing.
export default httpRule(
  'rfc9110/client-must-ignore-content-length-or-transfer-encoding-headers-in-response-to-connect',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST ignore any Content-Length or Transfer-Encoding header fields received in a successful response to CONNECT.',
  )
  .appliesTo('client')
  .done();
