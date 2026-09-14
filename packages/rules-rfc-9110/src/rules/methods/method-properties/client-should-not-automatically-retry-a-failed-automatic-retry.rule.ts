import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-should-not-automatically-retry-a-failed-automatic-retry',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    "This constrains the client's own internal retry policy across multiple requests over time; no field in any single message marks a request as an automatic retry of a failed automatic retry, and that lineage is not reconstructable from captured traffic.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description(
    'A client SHOULD NOT automatically retry a failed automatic retry.',
  )
  .appliesTo('client')
  .done();
