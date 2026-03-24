import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-interpret-if-unmodified-since-value-in-terms-of-servers-clock',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    "A recipient MUST interpret an If-Modified-Since field value's timestamp in terms of the origin server's clock.",
  )
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
