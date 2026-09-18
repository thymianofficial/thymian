import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, declining to upgrade — no hazard in the permission
export default httpRule('rfc9110/server-may-ignore-upgrade-header')
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A server that takes this up answers a request carrying Upgrade with an ordinary final status, where one that switches answers 101 (Switching Protocols) with an Upgrade of its own; both are recorded responses to a recorded request. The hint — an upgrade offer the server left on the table — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY ignore a received Upgrade header field if it wishes to continue using the current protocol on that connection. Upgrade cannot be used to insist on a protocol change.',
  )
  .summary('Server MAY ignore Upgrade header.')
  .appliesTo('server')
  .done();
