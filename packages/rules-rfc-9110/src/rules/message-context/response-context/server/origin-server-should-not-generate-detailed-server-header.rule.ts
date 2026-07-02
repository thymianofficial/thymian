import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/origin-server-should-not-generate-needlessly-fine-grained-detail-server-header',
)
  .severity('warn')
  // "needlessly fine-grained detail" is a subjective editorial judgment about
  // the Server value with no objective, machine-checkable threshold.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-server')
  .description(
    'An origin server SHOULD NOT generate a Server header field containing needlessly fine-grained detail',
  )
  .appliesTo('origin server')
  .done();
