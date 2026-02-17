import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-send-preference-headers-for-proactive-negotiation',
)
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-proactive-negotiation')
  .summary(
    "In order to improve the server's guess, a user agent MAY send request header fields that describe its preferences.",
  )
  .description(
    'Proactive negotiation is advantageous when the algorithm for selecting from among the available representations is difficult to describe to a user agent, or when the server desires to send its "best guess" to the user agent along with the first response (when that "best guess" is good enough for the user, this avoids the round-trip delay of a subsequent request). In order to improve the server\'s guess, a user agent MAY send request header fields that describe its preferences.',
  )
  .appliesTo('user-agent')
  .done();
