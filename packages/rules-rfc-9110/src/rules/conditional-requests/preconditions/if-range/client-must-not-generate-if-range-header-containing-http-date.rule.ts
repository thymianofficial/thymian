import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/client-must-not-generate-if-range-header-containing-http-date',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5')
  .description(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date unless the client has no entity tag for the corresponding representation and the date is a strong validator in the sense defined by Section 8.8.2.2.',
  )
  .summary(
    'A client MUST NOT generate an If-Range header field containing an HTTP-date.',
  )
  .appliesTo('client', 'user-agent')
  .tags('conditional-requests', 'if-range', 'evaluation')
  .done();
