import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-must-generate-multipart-byteranges-content-for-multi-part-206-response',
)
  .severity('error')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#112',
    "Triggered only 'if multiple parts are being transferred', a condition that requires parsing the multipart body. The framework does not expose parsed body parts, so the multi-part precondition cannot be established.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-multiple-parts')
  .description(
    'If multiple parts are being transferred, the server generating the 206 response MUST generate "multipart/byteranges" content and a Content-Type header field containing the "multipart/byteranges" media type and its required boundary parameter.',
  )
  .appliesTo('server')
  .done();
