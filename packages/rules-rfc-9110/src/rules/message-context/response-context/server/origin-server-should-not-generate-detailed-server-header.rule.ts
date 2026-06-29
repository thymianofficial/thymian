import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-not-generate-needlessly-fine-grained-detail-server-header',
)
  .severity('warn')
  // Informational (#327): a subjective SHOULD NOT ("needlessly fine-grained
  // detail" in the Server header). There is no objective threshold separating
  // conformant from non-conformant detail, so a programmatic check would be
  // arbitrary and false-positive prone. (The related security concern — leaking
  // precise software/versions — is best left to the operator's judgement.) No
  // rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server SHOULD NOT generate a Server header field containing needlessly fine-grained detail',
  )
  .appliesTo('origin server')
  .done();
