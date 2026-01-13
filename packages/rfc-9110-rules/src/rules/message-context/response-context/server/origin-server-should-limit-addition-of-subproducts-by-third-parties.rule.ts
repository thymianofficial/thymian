// origin-server-should-limit-addition-of-subproducts-by-third-parties
import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-limit-addition-of-subproducts-by-third-parties',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin SHOULD limit the addition of subproducts by third parties.',
  )
  .appliesTo('origin server')
  .done();
