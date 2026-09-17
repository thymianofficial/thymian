import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-remove-comments-before-forwarding',
)
  .severity('hint')
  .type(
    'informational',
    'nothing-to-check',
    'A permission — removing Via comments before forwarding is optional, so either form is compliant.',
  )
  .tags('security:disclosure')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'Comments in Via are optional, and a recipient MAY remove them prior to forwarding the message. This allows intermediaries to strip potentially sensitive or unnecessary information.',
  )
  .summary('Recipient MAY remove comments from Via header before forwarding.')
  .done();
