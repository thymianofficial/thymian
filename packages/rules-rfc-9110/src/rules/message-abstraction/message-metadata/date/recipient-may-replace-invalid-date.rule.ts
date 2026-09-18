import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/recipient-may-replace-invalid-date')
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    "Replacing the value happens in the recipient's own reading of the response; the adjacent MUST about appending a missing Date, not this permission, is what scopes rewriting a message that is cached or forwarded downstream. The invalid Date stays on the wire either way, so no message carries whether the substitution happened.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'A recipient with a clock that receives a response with an invalid Date header field value MAY replace that value with the time that response was received.',
  )
  .summary(
    'Recipients with a clock MAY replace invalid Date header with reception time.',
  )
  .done();
