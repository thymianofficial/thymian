import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-must-not-automatically-retry-non-idempontent-requests',
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods')
  .description('A proxy MUST NOT automatically retry non-idempotent requests.')
  .appliesTo('proxy')
  .done();
