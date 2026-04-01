import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-without-clock-must-not-generate-last-modified',
)
  .severity('error')
  .type('informational')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1')
  .description(
    `An origin server without a clock MUST NOT generate a Last-Modified date for a response unless that date value
    was assigned to the resource by some other system (presumably one with a clock).

    Note: This rule cannot be automatically validated because it requires knowledge of whether the server has a clock
    and whether Last-Modified values are generated locally or obtained from external systems. This must be verified
    through code review and system configuration analysis.`,
  )
  .summary(
    'Origin servers without a clock MUST NOT generate Last-Modified unless assigned by another system.',
  )
  .done();
