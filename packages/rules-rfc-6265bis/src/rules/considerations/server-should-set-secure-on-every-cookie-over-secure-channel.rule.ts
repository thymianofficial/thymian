import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { cookieWithoutSecureOverHttps } from '../utils/secure-channel.js';

const NAME =
  'rfc-6265bis/server-should-set-secure-on-every-cookie-over-secure-channel';

// The second clause of 8.3/2, and exact: unlike the first, it binds every
// server that uses cookies over a secure channel, and both the scheme and the
// Secure attribute are on the exchange. Where the scheme may be Thymian's
// server URL fallback, a cookie without Secure is left unjudged. A cookie a
// browser ignores at a §5.7 step, such as SameSite=None without Secure, is
// that step's rule's.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  cookieWithoutSecureOverHttps,
);

// A SHOULD, so a `warn`. `security:transport` beside `security:cookies`: the
// attribute is what keeps the cookie on the secure channel.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'security:transport')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.3',
  )
  .description(
    'When using cookies over a secure channel, servers SHOULD set the Secure attribute (see Section 4.1.2.5) for every cookie. If a server does not set the Secure attribute, the protection provided by the secure channel will be largely moot.',
  )
  .summary(
    'Server should set the Secure attribute on every cookie it sets over https.',
  )
  .explanation(
    'A browser sends a cookie without Secure over plain http too. An active attacker on the network can make the browser request any http URL of the host, even one nothing listens on, and read the cookie from that request: a session cookie set over https is stolen as easily as one set over http. Set Secure on every cookie a server sends over https.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
