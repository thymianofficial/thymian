import { httpRule } from '@thymian/core';

// This is API-design guidance gated on the service's intent ("selects a proper
// URI on behalf of the client"). Whether a given endpoint is conceptually a
// server-selects-the-URI operation is a semantic design judgement, not
// something derivable from the method/status/headers of a message. The SHOULD
// therefore cannot be mechanically checked.
export default httpRule(
  'rfc9110/service-that-selects-uri-for-client-should-use-post-instead-of-put',
)
  .severity('warn')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-put')
  .description(
    'A service that selects a proper URI on behalf of the client, after receiving a state-changing request, SHOULD be implemented using the POST method rather than PUT.',
  )
  .appliesTo('origin server')
  .done();
