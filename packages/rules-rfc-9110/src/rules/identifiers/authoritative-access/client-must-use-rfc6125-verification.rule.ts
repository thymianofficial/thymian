import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-use-rfc6125-verification')
  .severity('error')
  // RFC 6125 verification is TLS-handshake certificate logic below the recorded
  // HTTP layer; it cannot be checked from recorded HTTP messages.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description(
    'A client MUST verify the service identity using the verification process defined in Section 6 of RFC 6125 when establishing a secure HTTP connection.\n\nContext: This ensures that connections are only made to servers whose identities match the expected reference identity, preventing impersonation attacks as required in RFC 9110 section 4.3.4.',
  )
  .appliesTo('client')
  .done();
