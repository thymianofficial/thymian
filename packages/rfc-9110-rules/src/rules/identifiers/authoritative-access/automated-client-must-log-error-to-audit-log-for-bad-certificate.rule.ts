import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/automated-client-must-log-error-to-audit-log-for-bad-certificate',
)
  .severity('error')
  .type('informational')
  .url(
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-https-certificate-verificat',
  )
  .description(
    'Automated clients MUST log the error to an appropriate audit log (if available).',
  )
  .appliesTo('client')
  .done();
