import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check',
)
  .severity('error')
  // Informational (outcome 2): this MUST is about a client's configuration
  // surface (it must offer a setting that enables certificate checking). The
  // presence of such a setting is a property of the client product, not of any
  // HTTP transaction, and is not observable from messages or recorded traffic.
  // No lint/test/analyze function can apply. Kept as documentation.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MUST provide a configuration setting that enables certificate checking.',
  )
  .appliesTo('client')
  .done();
