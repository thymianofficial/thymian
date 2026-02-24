import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/request-content-location-asserts-representation',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the request has a Content-Location header field, then the sender asserts that the content is a representation of the resource identified by the Content-Location field value. However, such an assertion cannot be trusted unless it can be verified by other means (not defined by this specification). The information might still be useful for revision history links.',
  )
  .summary('Request Content-Location asserts content represents that resource.')
  .done();
