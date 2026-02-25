import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/sender-may-generate-comments-to-identify-software',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MAY generate comments to identify the software of each recipient, analogous to the User-Agent and Server header fields. However, comments in Via are optional.',
  )
  .summary('Sender MAY generate comments in Via header to identify software.')
  .done();
