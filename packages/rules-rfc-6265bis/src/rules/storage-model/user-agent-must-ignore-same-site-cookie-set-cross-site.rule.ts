import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { citeStep } from '../utils/set-cookie.js';
import {
  ignoredInStorage,
  isCrossSiteSubresourceOrNestedNavigation,
  sameSiteFlag,
} from '../utils/storage-model.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-same-site-cookie-set-cross-site';

const STEP = '5.7/step-18';

// `analytics` only, and heuristic there: Fetch Metadata request headers show
// a cross-site request that is no top-level navigation where the browser
// sends them, and their absence shows nothing, so a request without them is
// passed. One dropped cookie, one violation: a cookie that an exact step
// also ignores, for its Domain, its connection or a prefix, is reported by
// that step's rule, though step 18 comes first in the draft.
const { analytics } = cookieExchangeRuleFns(NAME, (cookie, exchange) => {
  const flag = sameSiteFlag(cookie);
  if (
    flag === 'None' ||
    !isCrossSiteSubresourceOrNestedNavigation(exchange.headers)
  ) {
    return undefined;
  }
  // A cookie an exact step ignores is that step's rule's.
  if (ignoredInStorage(cookie, exchange) !== undefined) {
    return undefined;
  }
  const asked = flag === 'Default' ? 'no SameSite of None' : `SameSite=${flag}`;
  return `A user agent ignores the cookie "${cookie.name}" entirely (${citeStep(STEP)}): it has ${asked}, and the request it answers is cross-site and no top-level navigation, by its Sec-Fetch-Site, Sec-Fetch-Mode and Sec-Fetch-Dest headers. Set SameSite=None and Secure on a cookie meant for cross-site use, or set it on a top-level navigation.`;
});

// The storage model is a MUST, but the rule is a warning: the request's
// site is read from headers a browser may send, which no server controls.
export default httpRule(NAME)
  .severity('warn')
  .type('analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.7',
  )
  .description(
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 18. If the cookie\'s same-site-flag is not "None": [...] 2. If the cookie was received from a "same-site" request (as defined in Section 5.2), skip the remaining substeps and continue processing the cookie. 3. If the cookie was received from a request which is navigating a top-level traversable [...], skip the remaining substeps and continue processing the cookie. [...] 4. Abort this algorithm and ignore the newly created cookie entirely.',
  )
  .summary(
    'User agent must ignore a cookie without SameSite=None set by a cross-site subresource request.',
  )
  .explanation(
    "A cookie without SameSite=None is one the browser keeps to its own site: it is not sent with a cross-site subresource request, and a response to such a request cannot set it either. A cookie without any SameSite attribute counts too: the step spares only SameSite=None. The cookie the server set in answer to an embedded or fetched request from another site is silently dropped, so a widget, an iframe or a cross-site API call that relies on it fails. Set SameSite=None and Secure on a cookie meant for cross-site use. This rule is a warning on a heuristic: it reads the request's site from the Fetch Metadata headers browsers send, and passes a request without them.",
  )
  .appliesTo('server')
  .overrideAnalyticsRule(analytics)
  .done();
