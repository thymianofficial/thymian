import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-should-verify-constraints-for-target-resource-for-put-request',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'An origin server SHOULD verify that the PUT representation is consistent with its configured constraints for the target resource.',
  )
  .appliesTo('origin server')
  .done();
