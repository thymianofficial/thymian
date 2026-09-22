import { httpRule } from '@thymian/core';

// eslint-disable-next-line thymian-internal/require-rule-tags -- no concern-tag member fits this rule's topic
export default httpRule(
  'rfc9110/user-agent-may-send-preference-headers-for-proactive-negotiation',
)
  .severity('hint')
  .type(
    'informational',
    'tool-limitation',
    'thymianofficial/thymian-workspace#141',
    'A user agent that takes this up sends Accept, Accept-Charset, Accept-Encoding or Accept-Language on the request. Those are field names, which is the one thing every context sees — no value, no second message, no captured trace required. The pairing that makes the finding worth emitting sits in the same transaction: a response carrying Vary names the dimensions the server actually negotiated over, so a request silent on a dimension the response says it varied by is visible directly. The `hint` — the server was left to guess on a dimension the client could have stated a preference for — is not written yet.',
  )
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-proactive-negotiation')
  .summary(
    "In order to improve the server's guess, a user agent MAY send request header fields that describe its preferences.",
  )
  .description(
    'Proactive negotiation is advantageous when the algorithm for selecting from among the available representations is difficult to describe to a user agent, or when the server desires to send its "best guess" to the user agent along with the first response (when that "best guess" is good enough for the user, this avoids the round-trip delay of a subsequent request). In order to improve the server\'s guess, a user agent MAY send request header fields that describe its preferences.',
  )
  .appliesTo('user-agent')
  .done();
