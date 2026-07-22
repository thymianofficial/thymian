import { httpRule } from '@thymian/core';

// A SHOULD about which HTTP protocol version a server puts in its response. The
// response version token is transport control data not surfaced by the rule
// framework, and "highest conformant version" is internal server capability.
// Not observable from a transaction.
export default httpRule(
  'rfc9110/server-should-send-response-version-equal-to-highest-conformant',
)
  .severity('warn')
  .type('informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    'A server SHOULD send a response version equal to the highest version to which the server is conformant that has a major version less than or equal to the one received in the request.',
  )
  .summary(
    'Servers SHOULD send response version matching highest conformant version compatible with request.',
  )
  .done();
