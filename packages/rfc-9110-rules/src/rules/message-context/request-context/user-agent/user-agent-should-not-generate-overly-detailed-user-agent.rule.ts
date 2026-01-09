import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-should-not-generate-overly-detailed-user-agent',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD NOT generate a User-Agent header field containing needlessly fine-grained detail and SHOULD limit the addition of subproducts by third parties. Overly long and detailed User-Agent field values increase request latency and the risk of a user being identified against their wishes ("fingerprinting").',
  )
  .appliesTo('user-agent')
  .done();
