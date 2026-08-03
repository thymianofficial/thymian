import { requestHeader } from '@thymian/core';
import { httpRule } from '@thymian/core';

export default httpRule('rfc9110/client-may-send-upgrade-header')
  .severity('hint')
  .type('analytics')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-upgrade')
  .description(
    'A client MAY send a list of protocol names in the Upgrade header field of a request to invite the server to switch to one or more of the named protocols, in order of descending preference, before sending the final response.',
  )
  .summary('Client MAY send Upgrade header to invite protocol switch.')
  .explanation(
    'A client is allowed to list one or more protocol names in an Upgrade request header to ask the server to switch to a different protocol on the same connection, in order of preference. This is entirely optional and the server is free to ignore it, so Upgrade cannot force a change. It matters because it gives clients a lightweight, backward-compatible way to negotiate an upgrade (for example to WebSocket) without breaking servers that do not support it.',
  )
  .appliesTo('client')
  // Surfaces use of the optional mechanism: the hint fires when a request
  // carries an Upgrade header, never on its absence.
  .rule((ctx) => ctx.validateHttpTransactions(requestHeader('upgrade')))
  .done();
