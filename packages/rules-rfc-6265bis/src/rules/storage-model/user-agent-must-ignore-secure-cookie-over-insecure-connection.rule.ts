import { httpRule } from '@thymian/core';

import {
  cookieExchangeRuleFns,
  TRANSPORT_NOT_JUDGED,
} from '../utils/exchange-contexts.js';
import { citeStep } from '../utils/set-cookie.js';
import { ignoredInStorage, isSecureOnly } from '../utils/storage-model.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-secure-cookie-over-insecure-connection';

const STEP = '5.7/step-13';

// Exact: the Secure attribute is in the line, and the scheme is the
// described server's in `static` and `test` and the recorded one in
// `analytics`. Where the scheme may be Thymian's server URL fallback, a
// Secure cookie is left unjudged. A cookie a browser already ignored at
// step 10, for its Domain, is that rule's.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    if (!exchange.transportJudged) {
      return isSecureOnly(cookie) ? TRANSPORT_NOT_JUDGED : undefined;
    }
    const ignored = ignoredInStorage(cookie, exchange);
    return ignored?.step === STEP
      ? `A user agent ignores the cookie "${cookie.name}" entirely (${citeStep(STEP)}): ${ignored.reason}. Set Secure cookies over https only.`
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
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 13. If the request-uri does not denote a "secure" connection (as defined by the user agent), and the cookie\'s secure-only-flag is true, then abort these steps and ignore the cookie entirely.',
  )
  .summary(
    'User agent must ignore a Secure cookie set over a non-secure connection.',
  )
  .explanation(
    'The Secure attribute keeps a cookie off plain-http connections, and a browser also refuses to let a plain-http response set one: otherwise an attacker on the network could inject Secure cookies that the https site then trusts. A Secure cookie set over http is silently dropped, so whatever relies on it does not work on that connection. Serve the response that sets the cookie over https, and redirect plain-http requests there first.',
  )
  .appliesTo('server')
  // `static` and `test` carry the described origin, so both skip the server
  // URL fallback; recorded traffic in `analytics` is real, so it never does.
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
