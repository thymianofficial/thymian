import { httpRule } from '@thymian/core';

import {
  cookieExchangeRuleFns,
  TRANSPORT_NOT_JUDGED,
} from '../utils/exchange-contexts.js';
import { citeStep } from '../utils/set-cookie.js';
import { domainAttribute, ignoredInStorage } from '../utils/storage-model.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-cookie-with-non-matching-domain';

const STEP = '5.7/step-10';

// Exact: the Domain is in the line, and the request host is the described
// server's in `static` and `test` and the recorded one in `analytics`. Where
// that host may be Thymian's server URL fallback, a cookie with a Domain is
// left unjudged: only one with something to judge makes the response a skip.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    if (!exchange.transportJudged) {
      return domainAttribute(cookie) === '' ? undefined : TRANSPORT_NOT_JUDGED;
    }
    const ignored = ignoredInStorage(cookie, exchange);
    return ignored?.step === STEP
      ? `A user agent ignores the cookie "${cookie.name}" entirely (${citeStep(STEP)}): ${ignored.reason}. Set a Domain that is the request host or one of its parent domains, or none, which makes the cookie host-only.`
      : undefined;
  },
);

// The storage model is a MUST ("the user agent MUST process the cookie as
// follows"), so the step is an `error`.
export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.7',
  )
  .description(
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 10. If the domain-attribute is non-empty: 1. If request-host-canonical does not domain-match (see Section 5.1.3) the domain-attribute: 1. Abort this algorithm and ignore the cookie entirely.',
  )
  .summary(
    'User agent must ignore a cookie whose Domain the request host does not domain-match.',
  )
  .explanation(
    'A server may scope a cookie to its own host or to a parent domain of it, never to an unrelated domain or to a subdomain of itself: otherwise any site could set cookies for any other. A browser refuses a cookie whose Domain attribute the host it requested does not domain-match, and the cookie the server set is silently dropped. A Domain that worked in one deployment often breaks in another, on a staging host or behind a new domain. Derive the Domain from the host that serves the response, or leave it out, which scopes the cookie to that host alone.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
