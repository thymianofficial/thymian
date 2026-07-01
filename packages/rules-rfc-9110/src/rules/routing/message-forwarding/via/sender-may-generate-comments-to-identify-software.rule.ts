import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-may-generate-comments-to-identify-software',
)
  .severity('hint')
  // Informational: permissive MAY — adding software-identifying comments to Via is optional, so their presence or absence is never a violation.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MAY generate comments to identify the software of each recipient, analogous to the User-Agent and Server header fields. However, comments in Via are optional.',
  )
  .summary('Sender MAY generate comments in Via header to identify software.')
  .done();
