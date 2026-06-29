import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-may-select-most-appropriate-choice-for-406-response',
)
  .severity('hint')
  // Permissive MAY describing an internal user-agent choice; no non-conformant
  // condition exists to detect. Informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-406-not-acceptable')
  .description(
    'A user agent MAY automatically select the most appropriate choice from that list.',
  )
  .appliesTo('user-agent')
  .done();
