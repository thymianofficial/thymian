import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { cookieKeptOverPlainHttp } from '../utils/secure-channel.js';

const NAME = 'rfc-6265bis/server-should-send-cookies-only-over-https';

// A convention rule, the exact twin of
// `server-requiring-higher-security-should-use-cookies-only-over-secure-channel`:
// draft-22 asks for cookies only over a secure channel from a server that
// requires a higher level of security, which no exchange shows, so that rule
// is heuristic and can never be promoted. Asking it of every server drops the
// condition and makes the check exact, so this one ships `off`, covers no
// unit, and a profile turns it on in the other's place. Where the scheme may
// be Thymian's server URL fallback, a cookie without Secure is left unjudged.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  cookieKeptOverPlainHttp('Set cookies over https only.'),
);

export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'security:transport')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.3',
  )
  .description(
    'A server should send Set-Cookie only over https. Draft-22 asks this only of servers that require a higher level of security; this is a convention.',
  )
  .summary('Server should set cookies over https only.')
  .explanation(
    'Draft-22 asks for cookies only over a secure channel from servers that require a higher level of security, a condition no exchange shows, and the recommended profile asks it of every server because a cookie set over plain http travels in clear text both ways, where anyone on the network can read, alter or inject it, and the cookies an API sets are nearly always its sessions and credentials.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
