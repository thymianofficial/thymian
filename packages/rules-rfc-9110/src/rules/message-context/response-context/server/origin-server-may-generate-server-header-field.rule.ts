import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-may-generate-server-header-field',
)
  .severity('hint')
  // Informational (#327): a permissive MAY — the origin server is free to emit a
  // Server header, or not. The previous rule flagged every response *without* a
  // Server header as a violation, which inverts the MAY and fires on conformant
  // traffic. (Omitting Server is in fact a common, security-positive choice as
  // it avoids advertising software/version details.) No non-conformant
  // condition exists, so the rule is reclassified informational with no rule
  // function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server MAY generate a Server header field in its responses.',
  )
  .appliesTo('origin server')
  .done();
