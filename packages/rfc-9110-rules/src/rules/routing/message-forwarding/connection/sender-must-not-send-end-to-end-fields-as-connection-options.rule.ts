import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-must-not-send-end-to-end-fields-as-connection-options',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-connection')
  .description(
    'A sender MUST NOT send a connection option corresponding to a field that is intended for all recipients of the content. For example, Cache-Control is never appropriate as a connection option. This ensures end-to-end fields are not incorrectly marked as hop-by-hop.',
  )
  .summary('Sender MUST NOT use end-to-end fields as connection options.')
  .done();
