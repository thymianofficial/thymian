import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- protocol-tracking accuracy, not a disclosure-shaping decision
export default httpRule(
  'rfc9110/sender-must-not-combine-via-entries-with-different-protocols',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    "Deciding whether combined Via entries had different protocols requires the sender's pre-combination Via values, which are not recoverable from the single forwarded message it produced.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MUST NOT combine members that have different received-protocol values. Combining Via entries is only permitted when the protocol versions are identical, as different protocols need to be separately tracked.',
  )
  .summary('Sender MUST NOT combine Via entries with different protocols.')
  .appliesTo('proxy')
  .done();
