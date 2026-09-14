import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule('rfc9110/server-may-terminate-request-for-413-response')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A MAY about terminating the request mid-flight (protocol-version dependent); nothing is non-conformant either way.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-413-content-too-large')
  .description(
    'The server MAY terminate the request, if the protocol version in use allows it.',
  )
  .appliesTo('server')
  .done();
