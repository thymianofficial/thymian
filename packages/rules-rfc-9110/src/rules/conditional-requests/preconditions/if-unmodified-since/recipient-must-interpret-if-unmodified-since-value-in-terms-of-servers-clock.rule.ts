import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/recipient-must-interpret-if-unmodified-since-value-in-terms-of-servers-clock',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.4')
  .description(
    "A recipient MUST interpret an If-Unmodified-Since field value's timestamp in terms of the origin server's clock.",
  )
  .summary(
    "Recipient MUST interpret the If-Unmodified-Since timestamp in terms of the origin server's clock.",
  )
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'if-unmodified-since', 'evaluation')
  .done();
