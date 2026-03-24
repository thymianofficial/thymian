import { httpRule } from '@thymian/core';

// in the future, we could analyze the request/response body and check if we can detect encodings that are not present in the headers
export default httpRule(
  'rfc9110/sender-must-generate-content-encoding-header-if-encodings-applied',
)
  .severity('error')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4')
  .description(
    `If one or more encodings have been applied to a representation, the sender that applied the encodings MUST generate a Content-Encoding header field that lists the content codings in the order in which they were applied.`,
  )
  .done();
