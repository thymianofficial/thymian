import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/sender-may-replace-host-with-pseudonym')
  .severity('hint')
  // Informational (outcome 2): replacing the received-by host with a pseudonym
  // is an explicit permission (MAY) exercised only when the real host is
  // considered sensitive. There is no non-conformant condition, and an observer
  // cannot distinguish a pseudonym from a real host name in a Via value anyway.
  // The previous implementation flagged every request that carried both a Host/
  // :authority and a Via header as a finding, which is not the rule at all. It
  // is reclassified to informational.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'The received-by portion of the Via header is normally the host and optional port number of a recipient server or client that subsequently forwarded the message. However, if the real host is considered to be sensitive information, a sender MAY replace it with a pseudonym.',
  )
  .summary('Sender MAY replace host with pseudonym in Via header.')
  .appliesTo('intermediary')
  .done();
