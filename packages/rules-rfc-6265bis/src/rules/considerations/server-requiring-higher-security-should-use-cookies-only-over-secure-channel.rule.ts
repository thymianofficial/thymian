import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { cookieKeptOverPlainHttp } from '../utils/secure-channel.js';

const NAME =
  'rfc-6265bis/server-requiring-higher-security-should-use-cookies-only-over-secure-channel';

// The first clause of 8.3/2. It binds only a server that requires a higher
// level of security, a choice no exchange shows, so the rule is heuristic in
// every context: it judges every server as if it were one. Its convention
// twin, `server-should-send-cookies-only-over-https`, asks the same of every
// server, exactly, and replaces it where a profile turns the twin on. Where
// the scheme may be Thymian's server URL fallback, a cookie without Secure is
// left unjudged.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  cookieKeptOverPlainHttp(
    'A server that requires a higher level of security should set cookies over https only.',
  ),
);

// A SHOULD, so a `warn`. `security:transport` beside `security:cookies`: the
// requirement is about the channel the cookies travel over.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'security:transport')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.3',
  )
  .description(
    'In addition to encrypting and signing the contents of every cookie, servers that require a higher level of security SHOULD use the Cookie and Set-Cookie header fields only over a secure channel.',
  )
  .summary(
    'Server that requires a higher level of security should use cookies only over https.',
  )
  .explanation(
    'Over plain http, every cookie travels in clear text both ways: an eavesdropper reads it, and an active attacker can alter or inject one. A server whose cookies carry a session or anything else worth protecting should set them over https only. This rule is a warning that treats every server as one that requires a higher level of security, because which servers do is not visible on the wire.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
