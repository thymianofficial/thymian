import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-without-clock-must-not-generate-date',
)
  .severity('error')
  .type(
    'informational',
    'only-origin-knows',
    'Whether the origin server has a clock is internal server state not exposed in any transaction, so a present or absent Date header cannot be classified as a violation.',
  )
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1')
  .description(
    'An origin server without a clock MUST NOT generate a Date header field.',
  )
  .summary(
    'Origin servers without a clock MUST NOT generate Date header field.',
  )
  .done();
