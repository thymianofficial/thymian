import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/client-should-not-automatically-retry-a-failed-automatic-retry',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description(
    'A client SHOULD NOT automatically retry a failed automatic retry.',
  )
  .appliesTo('client')
  .done();
