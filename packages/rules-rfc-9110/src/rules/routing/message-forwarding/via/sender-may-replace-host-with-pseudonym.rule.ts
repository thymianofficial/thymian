import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-replace-host-with-pseudonym')
  .severity('hint')
  .type(
    'informational',
    'peer-not-observable',
    'The received-by is a bare token whether it names the real host or the pseudonym standing in for it, and the real host — the one thing that would tell those apart — is exactly what the sender held back and never puts on the wire.',
  )
  .tags('security:disclosure')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'The received-by portion of the Via header is normally the host and optional port number of a recipient server or client that subsequently forwarded the message. However, if the real host is considered to be sensitive information, a sender MAY replace it with a pseudonym.',
  )
  .summary('Sender MAY replace host with pseudonym in Via header.')
  .done();
