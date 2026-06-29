import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-construct-reference-identity')
  .severity('error')
  // Informational (outcome 2): this MUST governs an internal step of the client's
  // TLS identity-verification algorithm (deriving an IP-ID vs DNS-ID reference
  // identity from the target host, per RFC 6125). It is purely client-side
  // verification logic that leaves no signal in any HTTP request, response, or
  // recorded traffic. No lint/test/analyze function can observe it. Kept as
  // documentation; security-relevant (see PR security section).
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    "A client MUST construct a reference identity from the service's host when verifying a secure HTTP connection: If the host is an IP address, use an IP-ID; if a registered name, use a DNS-ID.\n\nContext: This is required for proper service identity verification (RFC 6125), as specified in RFC 9110 section 4.3.4.",
  )
  .appliesTo('client')
  .done();
