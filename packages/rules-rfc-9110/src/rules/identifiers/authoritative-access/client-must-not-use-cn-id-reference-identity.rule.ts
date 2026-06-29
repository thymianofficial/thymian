import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-not-use-cn-id-reference-identity')
  .severity('error')
  // Informational (outcome 2): this MUST NOT forbids a choice inside the client's
  // TLS identity-verification logic (using a CN-ID reference identity). It is an
  // internal client decision with no observable footprint in HTTP messages or
  // recorded traffic. No lint/test/analyze function can detect it. Kept as
  // documentation; security-relevant (see PR security section).
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description('A client MUST NOT use a reference identity of type CN-ID.')
  .appliesTo('client')
  .done();
