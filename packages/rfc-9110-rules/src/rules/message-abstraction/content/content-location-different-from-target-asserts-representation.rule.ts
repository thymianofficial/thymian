import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/content-location-different-from-target-asserts-representation',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the response has a Content-Location header field and its field value is a reference to a URI different from the target URI, then the sender asserts that the content is a representation of the resource identified by the Content-Location field value. However, such an assertion cannot be trusted unless it can be verified by other means (not defined by this specification).',
  )
  .summary(
    'Response Content-Location differing from target asserts content represents that different resource.',
  )
  .done();
