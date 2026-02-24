import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/automated-clients-may-provide-setting-to-disable-certificate-check',
)
  .severity('hint')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MAY provide a configuration setting that disables certificate checking.',
  )
  .appliesTo('client')
  .done();
