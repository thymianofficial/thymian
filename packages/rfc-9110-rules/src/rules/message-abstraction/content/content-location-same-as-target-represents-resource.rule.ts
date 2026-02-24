import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/content-location-same-as-target-represents-resource',
)
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.4.2')
  .description(
    'If the response has a Content-Location header field and its field value is a reference to the same URI as the target URI, the content is a representation of the target resource.',
  )
  .summary(
    'Response Content-Location matching target URI means content represents target resource.',
  )
  .done();
