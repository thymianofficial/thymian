import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
)
  .severity('hint')
  // Informational (#327): permissive MAY about a client configuration setting —
  // no observable failure mode and not detectable from recorded HTTP traffic.
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MAY provide a configuration setting that disables certificate checking.',
  )
  .appliesTo('client')
  .done();
