import { httpRule } from '@thymian/core';

// This constrains the client's internal retry policy across multiple requests
// over time. There is no field in any single message marking a request as "an
// automatic retry of a failed automatic retry", and our captured-traffic model
// does not reconstruct a client's retry lineage, so the SHOULD NOT is not
// observable.
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
