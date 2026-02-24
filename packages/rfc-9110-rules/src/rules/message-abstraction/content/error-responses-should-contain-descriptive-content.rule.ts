import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/error-responses-should-contain-descriptive-content',
)
  .severity('hint')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    'Response messages with an error status code usually contain content that represents the error condition, such that the content describes the error state and what steps are suggested for resolving it.',
  )
  .summary(
    'Error responses should contain content describing the error and resolution steps.',
  )
  .done();
