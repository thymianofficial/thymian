import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/server-may-ignore-upgrade-header')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY ignore a received Upgrade header field if it wishes to continue using the current protocol on that connection. Upgrade cannot be used to insist on a protocol change.',
  )
  .summary('Server MAY ignore Upgrade header.')
  .appliesTo('server')
  .done();
