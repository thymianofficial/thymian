import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-should-not-automatically-repeat-request-for-403-response',
)
  .severity('warn')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Client-side SHOULD NOT governing an internal retry decision (do not automatically resend with the same credentials). Detecting a violation would require reliably linking a later request to an automatic retry of an earlier 403 and confirming identical credentials — an attribution internal to the client and not reconstructable from captured traffic (a user may legitimately re-issue the request).',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .summary(
    'The client SHOULD NOT automatically repeat the request with the same credentials.',
  )
  .description(
    'If authentication credentials were provided in the request, the server considers them insufficient to grant access. The client SHOULD NOT automatically repeat the request with the same credentials.',
  )
  .appliesTo('client')
  .done();
