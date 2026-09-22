import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/recipient-must-accept-lists-with-empty-elements',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    "Whether a recipient accepts a list containing empty elements is internal parsing behaviour with no observable signal, and Thymian cannot inject such a list into the peer's inbound path to probe it.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.1')
  .description(
    'In other words, a recipient MUST accept lists that satisfy the following syntax: #element => [ element ] *( OWS "," OWS [ element ] )',
  )
  .summary(
    'Recipient MUST accept lists with empty elements in the specified syntax.',
  )
  .done();
