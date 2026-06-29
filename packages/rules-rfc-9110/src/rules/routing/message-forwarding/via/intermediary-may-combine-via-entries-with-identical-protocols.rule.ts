import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-may-combine-via-entries-with-identical-protocols',
)
  .severity('hint')
  // Pure permission: an intermediary MAY combine entries with identical
  // received-protocol values. Combining or not combining are both conformant,
  // so there is no non-conformant condition to validate.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'An intermediary MAY combine an ordered subsequence of Via header field list members into a single member if the entries have identical received-protocol values. This can reduce header size while maintaining the essential routing information.',
  )
  .summary('Intermediary MAY combine Via entries with identical protocols.')
  .appliesTo('intermediary')
  .done();
