import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-not-combine-via-entries-with-different-protocols',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MUST NOT combine members that have different received-protocol values. Combining Via entries is only permitted when the protocol versions are identical, as different protocols need to be separately tracked.',
  )
  .summary('Sender MUST NOT combine Via entries with different protocols.')
  .appliesTo('proxy')
  .done();
