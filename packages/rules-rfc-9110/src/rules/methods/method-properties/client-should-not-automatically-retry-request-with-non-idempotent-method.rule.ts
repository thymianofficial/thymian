import { httpRule } from '@thymian/core';

// Informational: this governs the client's internal retry policy and is gated
// on client-only knowledge ("some means to know the semantics are idempotent /
// that the request was never applied"). Neither whether a retry was
// "automatic" nor the client's out-of-band knowledge is visible in any
// message, and our model does not reconstruct retry lineage, so the SHOULD NOT
// is not observable. The rule ships no function.
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
