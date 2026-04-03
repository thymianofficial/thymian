import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/automated-client-should-terminate-connection-for-bad-certificate',
)
  .severity('warn')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients SHOULD terminate the connection if HTTPS certificate verification fails.',
  )
  .appliesTo('client')
  .done();
