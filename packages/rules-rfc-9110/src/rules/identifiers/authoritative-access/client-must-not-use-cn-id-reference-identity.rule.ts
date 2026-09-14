import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-must-not-use-cn-id-reference-identity')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Which reference-identity type a client uses (rejecting CN-ID) is internal TLS certificate-verification logic; it leaves no trace in recorded HTTP messages.',
  )
  .tags('security:transport')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description('A client MUST NOT use a reference identity of type CN-ID.')
  .appliesTo('client')
  .done();
