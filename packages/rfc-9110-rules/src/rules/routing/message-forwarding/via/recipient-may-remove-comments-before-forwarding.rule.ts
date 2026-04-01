import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-remove-comments-before-forwarding',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'Comments in Via are optional, and a recipient MAY remove them prior to forwarding the message. This allows intermediaries to strip potentially sensitive or unnecessary information.',
  )
  .summary('Recipient MAY remove comments from Via header before forwarding.')
  .done();
