import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- date-value interpretation semantics, not a concern-axis topic
export default httpRule(
  'rfc9110/recipient-must-interpret-if-modified-since-value-in-terms-of-servers-clock',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    "How the recipient interprets the timestamp internally (against the origin's clock, not the client's) is not exposed on the wire; detecting a divergent interpretation would require correlating clock skew across many transactions.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    "A recipient MUST interpret an If-Modified-Since field value's timestamp in terms of the origin server's clock.",
  )
  .summary(
    "Recipient MUST interpret the If-Modified-Since timestamp in terms of the origin server's clock.",
  )
  .done();
