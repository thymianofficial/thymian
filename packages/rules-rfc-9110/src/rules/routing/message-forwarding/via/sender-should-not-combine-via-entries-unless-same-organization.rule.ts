import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-not-combine-via-entries-unless-same-organization',
)
  .severity('warn')
  // Like the different-protocols case, this concerns whether the sender combined
  // list members, and additionally depends on organizational-control knowledge
  // (which hosts are under the same administrative control) that is not encoded
  // in the message. Neither the combine action nor the org relationship is
  // observable from captured traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender SHOULD NOT combine multiple list members unless they are all under the same organizational control and the hosts have already been replaced by pseudonyms. This ensures transparency about the intermediaries involved in the request/response chain.',
  )
  .summary(
    'Sender SHOULD NOT combine Via entries unless under same organizational control.',
  )
  .done();
