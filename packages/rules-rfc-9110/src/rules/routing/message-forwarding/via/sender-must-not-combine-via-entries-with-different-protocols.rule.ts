import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-not-combine-via-entries-with-different-protocols',
)
  .severity('error')
  // Detecting a violation requires knowing that two list members differing in
  // received-protocol were *combined* by a sender, i.e. observing the merge
  // action across the inbound and outbound message at the intermediary. A single
  // captured Via value does not reveal whether distinct-protocol entries were
  // improperly combined, so it is not decidable from a single transaction or a
  // typical HAR.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MUST NOT combine members that have different received-protocol values. Combining Via entries is only permitted when the protocol versions are identical, as different protocols need to be separately tracked.',
  )
  .summary('Sender MUST NOT combine Via entries with different protocols.')
  .appliesTo('proxy')
  .done();
