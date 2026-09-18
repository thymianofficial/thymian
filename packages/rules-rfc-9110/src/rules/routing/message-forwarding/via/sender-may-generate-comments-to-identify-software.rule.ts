import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-may-generate-comments-to-identify-software',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A sender that takes this up writes a parenthesised comment naming its software after the received-by in its own Via member, and the recorded field value carries it verbatim. The hint — the Via comment discloses the software and version of a hop — is not written yet.',
  )
  .tags('security:disclosure')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-via')
  .description(
    'A sender MAY generate comments to identify the software of each recipient, analogous to the User-Agent and Server header fields. However, comments in Via are optional.',
  )
  .summary('Sender MAY generate comments in Via header to identify software.')
  .done();
