import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-verify-service-identity')
  .severity('error')
  // Informational (outcome 2): this MUST requires the client to confirm the
  // service's identity matches the URI's origin server before using a secured
  // connection. This is internal client-side verification performed during TLS
  // establishment; conformance or violation leaves no trace in HTTP messages or
  // recorded traffic. No lint/test/analyze function can observe it. Kept as
  // documentation; security-relevant (see PR security section).
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    "A client MUST verify that the service's identity is an acceptable match for the URI's origin server when establishing a secured connection to dereference a URI.\n\nContext: This verification ensures that an attacker cannot impersonate the server, supporting confidentiality and integrity for secure HTTP communication (HTTPS), as specified in RFC 9110 section 4.3.4.",
  )
  .appliesTo('client')
  .done();
