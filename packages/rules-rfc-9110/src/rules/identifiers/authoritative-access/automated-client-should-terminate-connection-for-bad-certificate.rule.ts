import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-client-should-terminate-connection-for-bad-certificate',
)
  .severity('warn')
  // Informational (outcome 2): this SHOULD concerns an automated client's
  // connection-handling decision on TLS certificate verification failure — an
  // internal client behavior at the transport layer. It is not observable from
  // HTTP messages or recorded traffic; a terminated connection produces no
  // transaction to inspect. No lint/test/analyze function can apply. Kept as
  // documentation of the requirement.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients SHOULD terminate the connection if HTTPS certificate verification fails.',
  )
  .appliesTo('client')
  .done();
