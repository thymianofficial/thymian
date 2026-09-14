import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/sender-should-limit-generated-product-identifiers-to-necessity',
)
  .severity('warn')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    "'Limit to what is necessary to identify the product' is a subjective design judgment with no objective threshold to test against.",
  )
  .tags('privacy:fingerprinting')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A sender SHOULD limit generated product identifiers to what is necessary to identify the product.',
  )
  .done();
