import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-ignore-content-length-or-transfer-encoding-headers-in-response-to-connect',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    'How the client interprets (ignores) Content-Length / Transfer-Encoding on a successful CONNECT response is an internal processing decision that leaves no trace on the wire, so it cannot be observed from a response, from recorded traffic, or by testing.',
  )
  // A successful CONNECT response becomes a raw tunnel; Content-Length or
  // Transfer-Encoding on it would falsely imply a framed HTTP body. One of the
  // two named canonical CONNECT-framing shapes for this tag (thymian-workspace#90).
  .tags('security:request-smuggling')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST ignore any Content-Length or Transfer-Encoding header fields received in a successful response to CONNECT.',
  )
  .appliesTo('client')
  .done();
