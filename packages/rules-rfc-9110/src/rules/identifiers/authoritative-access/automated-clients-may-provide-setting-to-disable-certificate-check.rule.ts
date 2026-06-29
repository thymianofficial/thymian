import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
)
  .severity('hint')
  // Informational (outcome 2): a permissive MAY about a client's configuration
  // surface (offering a setting to disable certificate checking). It describes
  // an allowed capability with no non-conformant condition to detect, and the
  // setting's existence is a property of the client product, not of any HTTP
  // transaction. Nothing to validate via lint/test/analyze. Kept as guidance.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MAY provide a configuration setting that disables certificate checking.',
  )
  .appliesTo('client')
  .done();
