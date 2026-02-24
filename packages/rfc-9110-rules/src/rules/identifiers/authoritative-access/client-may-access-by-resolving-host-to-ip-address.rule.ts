import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-may-access-by-resolving-host-to-ip-address',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-origins')
  .description(
    "A client MAY attempt access by resolving the host identifier to an IP address, establishing a TCP connection to that address on the indicated port, and sending over that connection an HTTP request message containing a request target that matches the client's target URI",
  )
  .appliesTo('client')
  .done();
