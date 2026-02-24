import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/get-203-content-is-potentially-modified-representation',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the request method is GET and the response status code is 203 (Non-Authoritative Information), the content is a potentially modified or enhanced representation of the target resource as provided by an intermediary.',
  )
  .summary(
    'GET 203 response content is potentially modified representation by intermediary.',
  )
  .done();
