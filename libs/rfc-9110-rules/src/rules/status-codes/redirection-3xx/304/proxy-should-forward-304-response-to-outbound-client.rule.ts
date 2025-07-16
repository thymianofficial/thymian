import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/proxy-should-forward-304-response-to-outbound-client'
)
  .severity('warn')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified')
  .description(
    'If the conditional request originated with an outbound client, such as a user agent with its own cache sending a conditional GET to a shared proxy, then the proxy SHOULD forward the 304 response to that client.'
  )
  .appliesTo('proxy')
  .done();
