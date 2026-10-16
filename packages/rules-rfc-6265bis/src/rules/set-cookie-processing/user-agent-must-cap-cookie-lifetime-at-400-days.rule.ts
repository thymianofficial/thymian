import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  onReceivedCookie,
  requestedLifetime,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/user-agent-must-cap-cookie-lifetime-at-400-days';

// §5.5: 400 days, in seconds.
const AGE_LIMIT_SECONDS = 400 * 24 * 60 * 60;

// The lifetime is the one the cookie keeps: the last Max-Age, which wins
// over any Expires, or else the last Expires (§5.7 step 6). An attribute
// that has no effect is capped too, but to no consequence, so it is not
// reported. An Expires is measured from the time of the run: in `static` that
// is all there is, and a recorded Expires measured later than it was received
// reads shorter, so the rule errs towards passing it.
//
// It reads only the cookie a user agent keeps; a line it ignores is the
// grammar rule's alone, or the size rule's. The grammar reports a malformed
// Max-Age or Expires, which a user agent ignores; the cap is a defect of its
// own, on a lifetime the user agent did read.
const check = onReceivedCookie((cookie) => {
  const lifetime = requestedLifetime(cookie, Date.now());
  if (lifetime === undefined || lifetime.seconds <= AGE_LIMIT_SECONDS) {
    return undefined;
  }
  const days = Math.floor(lifetime.seconds / (24 * 60 * 60));
  return `The cookie "${cookie.name}" asks, in its ${lifetime.attribute} attribute, for a lifetime of ${days} days, more than the 400 days a user agent following draft-22 keeps a cookie (§5.5, ${lifetime.attribute === 'Max-Age' ? '§5.6.2 step 6' : '§5.6.1 step 4'}): it expires after 400 days instead.`;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

// Three units, one lifetime: §5.5 states the cap, and §5.6.1 step 4 and
// §5.6.2 step 6 apply it to Expires and to Max-Age. A warning, heuristic in
// every context: the limit SHOULD NOT exceed 400 days, and §7.2 lets a user
// agent set it higher, so not every browser caps a longer lifetime.
// `privacy:tracking` beside `security:cookies`: the cap exists to bound how
// long a cookie can identify one user, the concern §7.4's rule on reasonable
// expiry carries below the cap.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies', 'privacy:tracking')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.5',
  )
  .description(
    'When processing cookies with a specified lifetime, either with the Expires or with the Max-Age attribute, the user agent MUST limit the maximum age of the cookie. The limit SHOULD NOT be greater than 400 days (34560000 seconds) in the future. The RECOMMENDED limit is 400 days in the future, but the user agent MAY adjust the limit (see Section 7.2). Expires or Max-Age attributes that specify a lifetime longer than the limit MUST be reduced to the limit.',
  )
  .summary(
    'User agent must cap a cookie lifetime longer than 400 days at its limit.',
  )
  .explanation(
    'Browsers keep a cookie for at most 400 days, however long its Expires or Max-Age asks for. A cookie the server set to last for years expires after 400 days, unless the server sets it again before then: a "remember me" or consent cookie meant to be permanent silently disappears once a year. Set lifetimes of 400 days or less, and refresh a cookie that must outlive that while the user is active. This rule is a warning, not an error, because a browser may choose a longer limit than 400 days.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
