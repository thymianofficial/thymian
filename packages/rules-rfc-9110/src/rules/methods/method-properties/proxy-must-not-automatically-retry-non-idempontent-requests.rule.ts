import { httpRule } from '@thymian/core';

// Detecting a proxy's automatic retry requires observing that the proxy re-sent
// the same non-idempotent request upstream after a failure — i.e. correlating
// multiple upstream attempts of one logical request at the proxy. A single
// captured transaction does not mark a request as a retry, and a typical HAR
// does not expose the proxy's upstream re-attempts, so the retry behavior is
// not observable in our model.
export default httpRule(
  'rfc9110/proxy-must-not-automatically-retry-non-idempontent-requests',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description('A proxy MUST NOT automatically retry non-idempotent requests.')
  .appliesTo('proxy')
  .done();
