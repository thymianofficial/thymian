import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-list-connection-specific-field-in-connection-header',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    'When a field aside from Connection is used to supply control information for or about the current connection, the sender MUST list the corresponding field name within the Connection header field. This enables proper hop-by-hop vs end-to-end field distinction.',
  )
  .summary('Sender MUST list connection-specific fields in Connection header.')
  .done();
