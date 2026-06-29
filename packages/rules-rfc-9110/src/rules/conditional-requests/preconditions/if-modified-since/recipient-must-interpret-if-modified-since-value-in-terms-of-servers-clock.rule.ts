import { httpRule } from '@thymian/core';

/**
 * Informational (outcome 2). This MUST governs how the recipient interprets the
 * timestamp internally (against the origin server's own clock rather than the
 * client's). The interpretation is not exposed on the wire and would only be
 * detectable by correlating clock skew across many transactions — not something
 * a single request/response, or the framework, can determine. Documentation
 * only.
 */
export default httpRule(
  'rfc9110/recipient-must-interpret-if-modified-since-value-in-terms-of-servers-clock',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.3')
  .description(
    "A recipient MUST interpret an If-Modified-Since field value's timestamp in terms of the origin server's clock.",
  )
  .summary(
    "Recipient MUST interpret the If-Modified-Since timestamp in terms of the origin server's clock.",
  )
  .appliesTo('server', 'origin server', 'cache')
  .tags('conditional-requests', 'if-modified-since', 'evaluation')
  .done();
