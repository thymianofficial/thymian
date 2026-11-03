import { httpRule } from '@thymian/core';

// Informational: the step turns on what the browser's cookie store already
// holds, a Secure cookie of the same name set earlier. One exchange cannot
// show it, and recorded traffic shows what one client was sent, not what it
// kept.
export default httpRule(
  'rfc-6265bis/user-agent-must-not-let-insecure-cookie-overlay-secure-cookie',
)
  .severity('error')
  .type(
    'informational',
    'peer-not-observable',
    "Whether a non-Secure cookie set over plain http is ignored depends on the browser's cookie store: on whether it already holds a Secure cookie of the same name whose domain and path the new one would overlay. No message Thymian sees, sends or records shows what a browser's store holds.",
  )
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.7',
  )
  .description(
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 16. If the cookie\'s secure-only-flag is false, and the request-uri does not denote a "secure" connection, then abort this algorithm and ignore the cookie entirely if the cookie store contains one or more cookies that meet all of the following criteria: 1. Their name matches the name of the newly-created cookie. 2. Their secure-only-flag is true. 3. Their domain domain-matches (see Section 5.1.3) the domain of the newly-created cookie, or vice-versa. 4. The path of the newly-created cookie path-matches the path of the existing cookie.',
  )
  .summary(
    'User agent must not let a cookie set over plain http overlay a stored Secure cookie of the same name.',
  )
  .explanation(
    "A plain-http response can be forged by anyone on the network. If it could replace a Secure cookie the https site set, an attacker could fix a victim's session or preferences to values of their choosing. So a browser ignores a non-Secure cookie set over http when it already holds a Secure cookie of the same name for an overlapping domain and path. A server that sets the same cookie over both http and https sees the http one silently dropped once the https one exists. Serve every response that sets cookies over https.",
  )
  .appliesTo('server')
  .done();
