import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/intermediary-must-attempt-to-send-outstanding-data-coming-from-closed-side-for-connect-request',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connect')
  .description(
    'A tunnel is closed when a tunnel intermediary detects that either side has closed its connection: the intermediary MUST attempt to send any outstanding data that came from the closed side to the other side, close both connections, and then discard any remaining data left undelivered.',
  )
  .appliesTo('intermediary')
  .done();
