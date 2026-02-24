import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/server-can-send-505-for-unsupported-version')
  .severity('hint')
  .type('analytics', 'informational')
  .appliesTo('server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.2')
  .description(
    "A server can send a 505 (HTTP Version Not Supported) response if it wishes, for any reason, to refuse service of the client's major protocol version.",
  )
  .summary(
    'Servers can send 505 response to refuse service for unsupported protocol versions.',
  )
  .done();
