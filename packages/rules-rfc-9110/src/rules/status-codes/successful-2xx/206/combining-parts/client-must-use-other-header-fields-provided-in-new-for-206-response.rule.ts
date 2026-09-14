import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/client-must-use-other-header-fields-provided-in-new-for-206-response',
)
  .severity('error')
  // Internal client cache-update behavior when combining partial responses;
  // not observable from emitted traffic.
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-combining-parts')
  .description(
    'the client MUST use other header fields provided in the new response, aside from Content-Range, to replace all instances of the corresponding header fields in the stored response.',
  )
  .appliesTo('client')
  .done();
