import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-send-3xx-response-if-state-change-should-be-applied-to-other-resource'
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'If the origin server will not make the requested PUT state change to the target resource and instead wishes to have it applied to a different resource, such as when the resource has been moved to a different URI, then the origin server MUST send an appropriate 3xx (Redirection) response.'
  )
  .appliesTo('origin server')
  .done();
