import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). This MUST governs how the recipient interprets the
 * If-Unmodified-Since timestamp internally (against the origin server's own
 * clock). The interpretation is not exposed on the wire and would only be
 * detectable by correlating clock skew across many transactions — not something
 * the framework can determine. Documentation only. (The description and tag have
 * been corrected to refer to If-Unmodified-Since rather than If-Modified-Since.)
 */
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
