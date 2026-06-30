import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-should-not-automatically-retry-request-with-non-idempotent-method',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description(
    'A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied.',
  )
  .appliesTo('client')
  .done();
