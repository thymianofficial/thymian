import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-not-use-cn-id-reference-identity')
  .severity('error')
  // Informational (#327): unobservable. Which reference-identity type a client
  // uses (rejecting CN-ID) is internal TLS certificate-verification logic; it
  // leaves no trace in recorded HTTP messages.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verification',
  )
  .description('A client MUST NOT use a reference identity of type CN-ID.')
  .appliesTo('client')
  .done();
