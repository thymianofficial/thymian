import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/origin-server-should-verify-constraints-for-target-resource-for-put-request',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    "Verifying a PUT representation against the server's own configured constraints is an internal processing step; its occurrence is not signaled by any message, and the constraints themselves are not observable.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'An origin server SHOULD verify that the PUT representation is consistent with its configured constraints for the target resource.',
  )
  .appliesTo('origin server')
  .done();
