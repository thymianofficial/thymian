import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-may-access-by-resolving-host-to-ip-address',
)
  .severity('hint')
  // Informational (outcome 2): a permissive MAY describing one allowed way a
  // client may dereference an origin (DNS resolution + TCP connect). It states
  // a capability with no non-conformant condition, and the underlying name
  // resolution / connection establishment happens below HTTP and is not visible
  // in any transaction or recorded traffic. Nothing to validate. Kept as guidance.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-origins')
  .description(
    "A client MAY attempt access by resolving the host identifier to an IP address, establishing a TCP connection to that address on the indicated port, and sending over that connection an HTTP request message containing a request target that matches the client's target URI",
  )
  .appliesTo('client')
  .done();
