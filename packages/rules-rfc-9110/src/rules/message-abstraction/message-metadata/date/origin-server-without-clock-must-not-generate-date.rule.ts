import { httpRule } from '@thymian/core';

// Informational (outcome 2): conformance is conditioned on whether the origin
// server has a clock, which is internal server state not exposed in any
// transaction. Without knowing the server lacks a clock, a present (or absent)
// Date header cannot be classified as a violation, so there is no observable
// non-conformant condition.
export default httpRule(
  'rfc9110/origin-server-without-clock-must-not-generate-date',
)
  .severity('error')
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server without a clock MUST NOT generate a Date header field.',
  )
  .summary(
    'Origin servers without a clock MUST NOT generate Date header field.',
  )
  .done();
