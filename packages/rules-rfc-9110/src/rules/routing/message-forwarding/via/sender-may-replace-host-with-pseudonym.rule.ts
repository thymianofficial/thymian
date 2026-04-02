import { and, or, requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-replace-host-with-pseudonym')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'The received-by portion of the Via header is normally the host and optional port number of a recipient server or client that subsequently forwarded the message. However, if the real host is considered to be sensitive information, a sender MAY replace it with a pseudonym.',
  )
  .summary('Sender MAY replace host with pseudonym in Via header.')
  .rule((ctx) =>
    ctx.validateHttpTransactions(
      and(
        or(requestHeader('host'), requestHeader(':authority')),
        requestHeader('via'),
      ),
    ),
  )
  .done();
