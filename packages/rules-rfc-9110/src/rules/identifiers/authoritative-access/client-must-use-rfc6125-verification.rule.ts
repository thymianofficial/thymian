import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-use-rfc6125-verification')
  .severity('error')
  // Informational (outcome 2): this MUST requires the client to run the RFC 6125
  // service-identity verification process during the TLS handshake. Whether the
  // client performed that verification is an internal client behavior at the
  // transport/security layer; it produces no signal in any HTTP request,
  // response, or recorded traffic. No lint/test/analyze function can observe it.
  // Kept as documentation; security-relevant (see PR security section).
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    'A client MUST verify the service identity using the verification process defined in Section 6 of RFC 6125 when establishing a secure HTTP connection.\n\nContext: This ensures that connections are only made to servers whose identities match the expected reference identity, preventing impersonation attacks as required in RFC 9110 section 4.3.4.',
  )
  .appliesTo('client')
  .done();
