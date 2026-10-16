import { httpRule } from '@thymian/core';

import {
  cookieExchangeRuleFns,
  TRANSPORT_NOT_JUDGED,
} from '../utils/exchange-contexts.js';
import { citeStep } from '../utils/set-cookie.js';
import {
  canonicalHost,
  domainAttribute,
  domainMatches,
} from '../utils/storage-model.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-cookie-with-public-suffix-domain';

const STEP = '5.7/step-9';

// Heuristic everywhere. Thymian carries no public suffix list, but a
// single-label Domain, such as "com" or "example", is a public suffix under
// any of them, by the list's implicit "*" rule; a multi-label suffix such as
// "co.uk" is missed. And the step binds only a browser configured to reject
// public suffixes, which every major browser is.
//
// A Domain identical to the request host is not ignored: the browser makes
// the cookie host-only instead. A Domain the request host does not
// domain-match is ignored at step 10 whatever the browser's configuration,
// and that rule reports it, so this one flags only a suffix the host does
// domain-match. Where the request host may be Thymian's server URL fallback,
// a single-label Domain is left unjudged.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    const domain = domainAttribute(cookie);
    if (domain === '' || domain.includes('.')) {
      return undefined;
    }
    if (!exchange.transportJudged) {
      return TRANSPORT_NOT_JUDGED;
    }
    const host = canonicalHost(exchange.origin);
    return host === undefined || host === domain || !domainMatches(host, domain)
      ? undefined
      : `A user agent that rejects public suffixes ignores the cookie "${cookie.name}" entirely (${citeStep(STEP)}): its Domain attribute, ${domain}, is a single label, which every public suffix list treats as a public suffix, and it is not the request host ${host}. Set the Domain to the registrable domain the host belongs to, or leave it out.`;
  },
);

// The storage model is a MUST, but the rule is a warning: the step binds only
// a browser configured to reject public suffixes, and without a public
// suffix list the check is a heuristic.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.7',
  )
  .description(
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 9. If the user agent is configured to reject "public suffixes" and the domain-attribute is a public suffix: [...] 3. If the domain-attribute is identical to the request-host-canonical: 1. Let the domain-attribute be the empty string. Otherwise: 1. Abort this algorithm and ignore the cookie entirely. Note: This step prevents attacker.example from disrupting the integrity of site.example by setting a cookie with a Domain attribute of "example".',
  )
  .summary(
    'User agent must ignore a cookie whose Domain is a public suffix other than the request host.',
  )
  .explanation(
    'A public suffix, such as com or co.uk, is a domain under which anyone can register a name. A cookie scoped to one would be sent to every site under it, so a browser refuses a cookie whose Domain attribute is a public suffix and silently drops it. Scope the cookie to the registrable domain the host belongs to, such as example.com, or leave the Domain out. This rule is a warning on a heuristic: without a public suffix list it recognizes only a single-label Domain, and only a browser configured to reject public suffixes drops the cookie.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
