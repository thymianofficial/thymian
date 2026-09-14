import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-must-not-send-non-conformant-version')
  .severity('error')
  .type(
    'informational',
    'peer-internal-behaviour',
    'Whether a server is conformant to the HTTP version it sends is internal server state; the response version token itself is also not surfaced by the rule framework.',
  )
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    "A server SHOULD send a response version equal to the highest version to which the server is conformant that has a major version less than or equal to the one received in the request. A server MUST NOT send a version to which it is not conformant. A server can send a 505 (HTTP Version Not Supported) response if it wishes, for any reason, to refuse service of the client's major protocol version.",
  )
  .summary('Servers MUST NOT send HTTP version they are not conformant to.')
  .done();
