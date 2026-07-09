import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-construct-reference-identity')
  .severity('error')
  // How a client constructs its TLS reference identity (IP-ID vs DNS-ID) is
  // internal certificate-verification logic at the transport layer; it leaves
  // no trace in recorded HTTP messages.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    "A client MUST construct a reference identity from the service's host when verifying a secure HTTP connection: If the host is an IP address, use an IP-ID; if a registered name, use a DNS-ID.\n\nContext: This is required for proper service identity verification (RFC 6125), as specified in RFC 9110 section 4.3.4.",
  )
  .appliesTo('client')
  .done();
