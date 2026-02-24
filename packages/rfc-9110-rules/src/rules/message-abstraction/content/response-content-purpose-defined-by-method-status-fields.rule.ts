import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/response-content-purpose-defined-by-method-status-fields',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.1')
  .description(
    "In a response, the content's purpose is defined by the request method, response status code, and response fields describing that content. For example, the content of a 200 (OK) response to GET represents the current state of the target resource, as observed at the time of the message origination date, whereas the content of the same status code in a response to POST might represent either the processing result or the new state of the target resource after applying the processing.",
  )
  .summary(
    'Response content purpose is defined by request method, status code, and response fields.',
  )
  .done();
