import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-combine-via-entries-unless-same-organization',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender SHOULD NOT combine multiple list members unless they are all under the same organizational control and the hosts have already been replaced by pseudonyms. This ensures transparency about the intermediaries involved in the request/response chain.',
  )
  .summary(
    'Sender SHOULD NOT combine Via entries unless under same organizational control.',
  )
  .done();
