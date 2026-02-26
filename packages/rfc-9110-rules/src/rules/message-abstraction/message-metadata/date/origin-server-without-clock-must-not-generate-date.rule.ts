import { httpRule } from '@thymian/http-linter';

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
