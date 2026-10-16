import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { requestedLifetime } from '../utils/set-cookie.js';
import { ignoredInStorage } from '../utils/storage-model.js';

const NAME = 'rfc-6265bis/server-should-select-reasonable-cookie-expiration';

const SECONDS_PER_DAY = 24 * 60 * 60;

// §7.4's own example: "a typical session identifier might reasonably be set
// to expire in two weeks".
const SESSION_LIFETIME_SECONDS = 14 * SECONDS_PER_DAY;

// §5.5's cap. A longer lifetime is the cap rule's, which says that a browser
// shortens it; this rule judges the lifetimes a browser keeps.
const AGE_LIMIT_SECONDS = 400 * SECONDS_PER_DAY;

// A cookie name that reads as a session identifier: "session" or "sessid"
// anywhere, or "sid" or "sess" as a whole word of the name — SID,
// JSESSIONID, PHPSESSID, ASP.NET_SessionId, connect.sid, laravel_session. A
// __Secure- or __Host- prefix does not change what the name says.
const SESSION_IDENTIFIER_NAME =
  /session|sessid|(?:^|[_.-])(?:sid|sess)(?:$|[_.-])/;

function readsAsSessionIdentifier(name: string): boolean {
  return SESSION_IDENTIFIER_NAME.test(
    name.toLowerCase().replace(/^__(?:secure|host)-/, ''),
  );
}

// Heuristic in every context: what is reasonable depends on the cookie's
// purpose, which no exchange shows. The one purpose a name gives away, and
// the one the draft gives a lifetime for, is a session identifier, so the
// rule judges a cookie whose name reads as one against the draft's two
// weeks, and passes every other. An Expires is measured from the time of the
// run, as in the cap rule. A cookie a browser ignores, which the rule on why
// reports, is left out.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    if (
      !readsAsSessionIdentifier(cookie.name) ||
      ignoredInStorage(cookie, exchange) !== undefined
    ) {
      return undefined;
    }
    const lifetime = requestedLifetime(cookie, Date.now());
    if (
      lifetime === undefined ||
      lifetime.seconds <= SESSION_LIFETIME_SECONDS ||
      lifetime.seconds > AGE_LIMIT_SECONDS
    ) {
      return undefined;
    }
    const days = Math.ceil(lifetime.seconds / SECONDS_PER_DAY);
    return `The cookie "${cookie.name}" reads as a session identifier and asks, in its ${lifetime.attribute} attribute, for a lifetime of ${days} days. Draft-22 gives two weeks as a reasonable lifetime for a typical session identifier (§7.4): a longer one keeps the user identifiable, and a stolen session usable, for longer than a session needs. Select a lifetime that fits the cookie's purpose, or leave a session cookie without Expires and Max-Age.`;
  },
);

// A SHOULD, so a `warn`. `privacy:tracking` beside `security:cookies`: the
// paragraph asks for short lifetimes to "promote user privacy", the concern
// the cap rule carries above 400 days.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'privacy:tracking')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-7.4',
  )
  .description(
    'Although servers can set the expiration date for cookies to the distant future, most user agents do not actually retain cookies for multiple decades. Rather than choosing gratuitously long expiration periods, servers SHOULD promote user privacy by selecting reasonable cookie expiration periods based on the purpose of the cookie. For example, a typical session identifier might reasonably be set to expire in two weeks.',
  )
  .summary(
    'Server should select a cookie lifetime that fits the purpose of the cookie.',
  )
  .explanation(
    'Every day a cookie lives is a day it identifies the same user, and a day a stolen copy of it still works. A session identifier that lasts for months keeps both windows open long after the session ended. This rule is a warning that judges only cookies whose name reads as a session identifier, against the two weeks draft-22 gives as reasonable for one, because the purpose of any other cookie is not visible on the wire.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
