import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-not-generate-detailed-server-header',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server SHOULD NOT generate a Server header field containing needlessly fine-grained detail and SHOULD limit the addition of subproducts by third parties. Overly long and detailed Server field values increase response latency and potentially reveal internal implementation details that might make it (slightly) easier for attackers to find and exploit known security holes.',
  )
  .appliesTo('origin server')
  .done();
