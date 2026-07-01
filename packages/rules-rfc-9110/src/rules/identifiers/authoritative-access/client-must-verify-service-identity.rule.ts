import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-verify-service-identity')
  .severity('error')
  // Informational (#327): unobservable. Service-identity verification happens
  // during the TLS handshake, below the recorded HTTP layer; a successful or
  // skipped check leaves no distinguishing trace in HTTP messages.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    "A client MUST verify that the service's identity is an acceptable match for the URI's origin server when establishing a secured connection to dereference a URI.\n\nContext: This verification ensures that an attacker cannot impersonate the server, supporting confidentiality and integrity for secure HTTP communication (HTTPS), as specified in RFC 9110 section 4.3.4.",
  )
  .appliesTo('client')
  .done();
