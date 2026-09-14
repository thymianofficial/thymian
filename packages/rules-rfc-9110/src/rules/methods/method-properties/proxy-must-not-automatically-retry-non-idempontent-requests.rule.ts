import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/proxy-must-not-automatically-retry-non-idempontent-requests',
)
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    "Detecting a proxy's own automatic retry requires correlating multiple upstream attempts of one logical request at the proxy; a single captured transaction does not mark a request as a retry, and a typical HAR does not expose the proxy's upstream re-attempts.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description('A proxy MUST NOT automatically retry non-idempotent requests.')
  .appliesTo('proxy')
  .done();
