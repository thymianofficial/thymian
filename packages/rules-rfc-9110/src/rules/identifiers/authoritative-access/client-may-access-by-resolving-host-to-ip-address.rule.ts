import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-access-by-resolving-host-to-ip-address',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Resolving the host identifier and opening the TCP connection happen inside the client, beneath the HTTP layer a trace records. A captured request shows the target it was sent with, but not how the client reached that address, nor whether it took this route rather than an alternative service.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-http-origins')
  .description(
    "A client MAY attempt access by resolving the host identifier to an IP address, establishing a TCP connection to that address on the indicated port, and sending over that connection an HTTP request message containing a request target that matches the client's target URI",
  )
  .appliesTo('client')
  .done();
