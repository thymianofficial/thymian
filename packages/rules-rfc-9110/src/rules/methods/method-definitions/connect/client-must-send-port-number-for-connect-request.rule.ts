import { httpRule } from '@thymian/core';

// Informational: this is a request-side MUST about the authority-form
// request-target of a CONNECT request (the port must be explicit). Thymian
// generates requests from an OpenAPI description, which does not model CONNECT
// tunnels or authority-form targets, so `test` cannot exercise it. The
// request-target's authority/port is not preserved as an observable field in
// our captured-traffic model either (a HAR records a normal URL, not the
// CONNECT authority-form target), so `analyze` cannot reliably detect an
// elided port. The rule therefore ships no function.
export default httpRule(
  'rfc9110/client-must-send-port-number-for-connect-request',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A client MUST send the port number even if the CONNECT request is based on a URI reference that contains an authority component with an elided port.',
  )
  .appliesTo('client')
  .done();
