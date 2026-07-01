import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-client-should-terminate-connection-for-bad-certificate',
)
  .severity('warn')
  // Informational (#327): unobservable. Terminating the connection on failed
  // certificate verification is a TLS-layer action; a torn-down handshake
  // leaves no recorded HTTP transaction to inspect.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients SHOULD terminate the connection if HTTPS certificate verification fails.',
  )
  .appliesTo('client')
  .done();
