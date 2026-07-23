import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-must-only-generate-crlf-for-line-breaks-between-parts',
)
  .severity('error')
  // Line breaks between multipart body parts live inside the raw body bytes. No
  // context exposes intra-body CRLF-vs-LF structure: static sees only schemas,
  // and test/analytics expose body content but the rule engine does not parse
  // multipart boundaries.
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.3')
  .description(
    'A sender MUST generate only CRLF to represent line breaks between body parts.',
  )
  .done();
