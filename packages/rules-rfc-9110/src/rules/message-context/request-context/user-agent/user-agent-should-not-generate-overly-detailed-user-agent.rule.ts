import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
)
  .severity('hint')
  // Informational: "needlessly fine-grained detail" is a subjective editorial
  // judgment about the User-Agent value with no objective, machine-checkable
  // threshold; surfaced as guidance rather than an automated check.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD NOT generate a User-Agent header field containing needlessly fine-grained detail.',
  )
  .appliesTo('user-agent')
  .done();
