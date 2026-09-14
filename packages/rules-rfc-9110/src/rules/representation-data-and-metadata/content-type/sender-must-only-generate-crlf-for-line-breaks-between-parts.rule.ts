import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- intra-body multipart formatting, not a message-boundary-between-hops concern
export default httpRule(
  'rfc9110/sender-must-only-generate-crlf-for-line-breaks-between-parts',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    'Line breaks between multipart body parts live inside the raw body bytes. No context can see the CRLF-vs-LF structure between parts because neither the common projection nor the live HttpResponse shape parses a multipart body into its parts at all.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.3')
  .description(
    'A sender MUST generate only CRLF to represent line breaks between body parts.',
  )
  .done();
