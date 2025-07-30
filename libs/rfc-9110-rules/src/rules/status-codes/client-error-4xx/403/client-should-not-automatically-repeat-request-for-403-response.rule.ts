import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-should-not-automatically-repeat-request-for-403-response'
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .summary(
    'The client SHOULD NOT automatically repeat the request with the same credentials.'
  )
  .description(
    'If authentication credentials were provided in the request, the server considers them insufficient to grant access. The client SHOULD NOT automatically repeat the request with the same credentials.'
  )
  .appliesTo('client')
  .done();
