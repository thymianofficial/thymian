import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-may-repeat-request-with-new-credentials-for-403-response',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A client that takes this up repeats the request with a different set of credentials, which a captured trace carries as a later transaction against the same target. The hint — a 403 that was never followed by a repeat carrying new credentials — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden')
  .description(
    'The client MAY repeat the request with new or different credentials.',
  )
  .appliesTo('client')
  .done();
