import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/server-should-send-response-version-equal-to-highest-conformant',
)
  .severity('warn')
  .type(
    'informational',
    'peer-not-observable',
    '"Highest conformant version" is internal server capability not observable from a transaction.',
  )
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A server SHOULD send a response version equal to the highest version to which the server is conformant that has a major version less than or equal to the one received in the request.',
  )
  .summary(
    'Servers SHOULD send response version matching highest conformant version compatible with request.',
  )
  .done();
