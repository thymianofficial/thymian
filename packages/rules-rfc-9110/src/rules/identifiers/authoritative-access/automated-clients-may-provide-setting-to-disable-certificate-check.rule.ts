import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
)
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'Whether an automated client offers a switch for certificate checking is settled in its own configuration surface, and no request or response carries it. The check that switch governs runs in the TLS handshake, beneath the HTTP messages a trace records.',
  )
  .tags('security:transport')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MAY provide a configuration setting that disables certificate checking.',
  )
  .appliesTo('client')
  .done();
