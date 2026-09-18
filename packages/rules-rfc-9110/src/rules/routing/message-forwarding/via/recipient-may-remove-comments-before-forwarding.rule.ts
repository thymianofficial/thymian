import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-may-remove-comments-before-forwarding',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A recipient that takes this up forwards a Via member stripped of the comment it arrived with, where one that declines passes the software identification on to the next hop; a multi-hop trace holds the received and the forwarded Via. The hint — a forwarded Via still naming each hop by its software — is not written yet.',
  )
  .tags('security:disclosure')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'Comments in Via are optional, and a recipient MAY remove them prior to forwarding the message. This allows intermediaries to strip potentially sensitive or unnecessary information.',
  )
  .summary('Recipient MAY remove comments from Via header before forwarding.')
  .done();
