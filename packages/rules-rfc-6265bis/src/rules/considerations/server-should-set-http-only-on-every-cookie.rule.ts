import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { isHttpOnly, keptByBrowser } from '../utils/storage-model.js';

const NAME = 'rfc-6265bis/server-should-set-http-only-on-every-cookie';

// A convention rule: draft-22 defines HttpOnly (§4.1.2.6, non-normative) and
// what a browser does with it (§5.7 steps 14 and 15), and requires it of no
// server. It ships `off`, covers no unit, and a profile turns it on.
//
// Exact in every context: the attribute is in the line. It judges only a
// cookie a browser keeps, so a line that clears its cookie, and a cookie a
// browser ignores, which the rule on why reports, are left out. The scheme
// plays no part, so the server URL fallback is judged like any other origin.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) =>
    isHttpOnly(cookie) || !keptByBrowser(cookie, exchange)
      ? undefined
      : `The cookie "${cookie.name}" has no HttpOnly attribute, so a script running in the page can read it through a non-HTTP API such as document.cookie. Add the HttpOnly attribute, unless a script must read the cookie.`,
);

// `security:cookies` alone: script access to a cookie is the cookie's own
// scope, and the XSS it limits has no tag of its own.
export default httpRule(NAME)
  .severity('off')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.2.6',
  )
  .description(
    'A server should set the HttpOnly attribute on every cookie. Draft-22 defines the attribute, which instructs the user agent to omit the cookie when providing access to cookies via non-HTTP APIs, but requires it nowhere; this is a convention.',
  )
  .summary('Server should set the HttpOnly attribute on every cookie.')
  .explanation(
    'Draft-22 defines HttpOnly, in a non-normative section, without requiring it of any server, and the recommended profile asks for it on every cookie because a cookie without it is readable by any script running in the page, so a single cross-site scripting flaw hands an attacker the session cookie, while the few cookies a script must read can be exempted deliberately.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
