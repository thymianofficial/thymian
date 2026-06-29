import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-limit-generated-product-identifiers-to-necessity',
)
  .severity('warn')
  // Informational (#327): a subjective SHOULD ("limit to what is necessary").
  // There is no objective, non-arbitrary threshold that distinguishes a
  // conformant from a non-conformant product identifier, so a programmatic check
  // would be unreliable (false positives). No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender SHOULD limit generated product identifiers to what is necessary to identify the product.',
  )
  .done();
