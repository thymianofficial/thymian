import { httpRule } from '@thymian/core';

export default httpRule(
  'rfc9110/user-agent-should-not-generate-needlessly-fine-grained-detailed-user-agent-field',
)
  .severity('hint')
  // Informational (#327): a subjective SHOULD NOT ("needlessly fine-grained
  // detail"). There is no objective threshold separating conformant from
  // non-conformant detail, so a programmatic check would be arbitrary and
  // false-positive prone. No rule function.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent')
  .description(
    'A user agent SHOULD NOT generate a User-Agent header field containing needlessly fine-grained detail.',
  )
  .appliesTo('user-agent')
  .done();
