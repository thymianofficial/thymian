import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/service-that-selects-uri-for-client-should-use-post-instead-of-put',
)
  .severity('warn')
  .type(
    'informational',
    'origin-internal-ground-truth',
    "Whether an endpoint is conceptually a server-selects-the-URI operation is a semantic design judgement about the service's own intent, not something derivable from the method, status, or headers of a message.",
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'A service that selects a proper URI on behalf of the client, after receiving a state-changing request, SHOULD be implemented using the POST method rather than PUT.',
  )
  .appliesTo('origin server')
  .done();
