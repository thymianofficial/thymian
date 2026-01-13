import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc/sender-should-limit-generated-product-identifiers-to-necessity',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender SHOULD limit generated product identifiers to what is necessary to identify the product.',
  )
  .done();
