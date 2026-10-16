import { httpRule } from '@thymian/core';

// Informational: a session fixation is a session identifier transplanted
// from the attacker's user agent to the victim's, which turns on which
// cookie identifies a session and where its value came from. Neither is on
// the wire: only the origin knows.
export default httpRule('rfc-6265bis/server-should-avoid-session-fixation')
  .severity('warn')
  .type(
    'informational',
    'only-origin-knows',
    "Avoiding session fixation means issuing a new session identifier when a session gains authority, such as at login, rather than keeping one the client already presented. Which cookie is a session identifier, when a session gains authority, and whether the identifier after it was minted by the server or brought by the client is the origin's own state. A message shows a cookie being set, not whether its value was transplanted from another user agent.",
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.4',
  )
  .description(
    "Using session identifiers is not without risk. For example, the server SHOULD take care to avoid \"session fixation\" vulnerabilities. A session fixation attack proceeds in three steps. First, the attacker transplants a session identifier from his or her user agent to the victim's user agent. Second, the victim uses that session identifier to interact with the server, possibly imbuing the session identifier with the user's credentials or confidential information. Third, the attacker uses the session identifier to interact with server directly, possibly obtaining the user's authority or confidential information.",
  )
  .summary('Server should take care to avoid session fixation.')
  .explanation(
    "An attacker who can plant a session identifier of their choosing in a victim's browser, before the victim signs in, owns the session once the victim does. Issue a new session identifier whenever a session gains authority, such as at login or on a change of privileges, and never accept one the server did not issue.",
  )
  .appliesTo('server')
  .done();
