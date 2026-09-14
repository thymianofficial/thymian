import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Presence of a client configuration setting is a product-capability requirement; it cannot be detected from recorded HTTP traffic.',
  )
  .tags('security:transport')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MUST provide a configuration setting that enables certificate checking.',
  )
  .appliesTo('client')
  .done();
