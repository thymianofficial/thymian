import { httpRule } from '@thymian/core';

// This is a purely permissive MAY — an origin server is free to accept CONNECT
// or not. There is no non-conformant outcome to detect: 501 is a perfectly
// conformant way for a server that does not implement CONNECT to respond, and
// accepting CONNECT is equally conformant. Nothing observable can violate a MAY.
export default httpRule('rfc9110/origin-sever-may-accept-connect-request')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'An origin server MAY accept a CONNECT request, but most origin servers do not implement CONNECT',
  )
  .appliesTo('origin server')
  .done();
