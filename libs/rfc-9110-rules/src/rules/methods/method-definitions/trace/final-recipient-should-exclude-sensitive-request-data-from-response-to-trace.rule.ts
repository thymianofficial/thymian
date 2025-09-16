import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/final-recipient-should-exclude-sensitive-request-data-from-response-to-trace'
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-trace')
  .description(
    'The final recipient of the request SHOULD exclude any request fields that are likely to contain sensitive data when that recipient generates the response content.'
  )
  .appliesTo('server')
  .done();
