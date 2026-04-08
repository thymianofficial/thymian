import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/automated-clients-must-provide-setting-to-enable-certificate-check',
)
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MUST provide a configuration setting that enables certificate checking.',
  )
  .appliesTo('client')
  .done();
