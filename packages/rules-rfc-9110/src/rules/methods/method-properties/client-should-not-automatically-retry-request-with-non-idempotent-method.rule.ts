import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-should-not-automatically-retry-request-with-non-idempotent-method',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    "This governs the client's own internal retry policy and is gated on client-only knowledge (whether it has some means to know the semantics are idempotent, or that the request was never applied); neither that knowledge nor whether a retry was automatic is visible in any message.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description(
    'A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied.',
  )
  .appliesTo('client')
  .done();
