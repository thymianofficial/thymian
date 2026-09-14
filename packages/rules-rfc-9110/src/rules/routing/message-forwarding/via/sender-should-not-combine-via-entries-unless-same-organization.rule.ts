import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- cross-organization Via combining is deployment/administrative knowledge not present in the message
export default httpRule(
  'rfc9110/sender-should-not-combine-via-entries-unless-same-organization',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    "Whether combined Via entries belong to the same organization is deployment/administrative knowledge only the combining sender's own operator has — not present in the message.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender SHOULD NOT combine multiple list members unless they are all under the same organizational control and the hosts have already been replaced by pseudonyms. This ensures transparency about the intermediaries involved in the request/response chain.',
  )
  .summary(
    'Sender SHOULD NOT combine Via entries unless under same organizational control.',
  )
  .done();
