import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- permissive MAY, declining to upgrade — no hazard in the permission
export default httpRule('rfc9110/server-may-ignore-upgrade-header')
  .severity('hint')
  .type(
    'informational',
    'permission-or-statement-of-fact',
    'A permission — a server ignoring Upgrade is an allowed internal decision, so neither outcome is a violation.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A server MAY ignore a received Upgrade header field if it wishes to continue using the current protocol on that connection. Upgrade cannot be used to insist on a protocol change.',
  )
  .summary('Server MAY ignore Upgrade header.')
  .appliesTo('server')
  .done();
