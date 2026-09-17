import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    "'Needlessly fine-grained detail' is a subjective editorial judgment about the User-Agent value with no objective, machine-checkable threshold.",
  )
  .tags('privacy:fingerprinting')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD NOT generate a User-Agent header field containing needlessly fine-grained detail.',
  )
  .appliesTo('user-agent')
  .done();
