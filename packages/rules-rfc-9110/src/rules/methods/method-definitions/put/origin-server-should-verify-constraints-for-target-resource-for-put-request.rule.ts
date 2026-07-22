import { httpRule } from '@thymian/core';

// "Verifying" the PUT representation against the server's configured
// constraints is an internal processing step. Its occurrence is not signaled by
// any message, and the server's configured constraints are not observable, so
// the SHOULD cannot be checked.
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
