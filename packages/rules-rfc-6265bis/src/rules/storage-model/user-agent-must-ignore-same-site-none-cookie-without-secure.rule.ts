import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { citeStep } from '../utils/set-cookie.js';
import { ignoredInStorage } from '../utils/storage-model.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-same-site-none-cookie-without-secure';

const STEP = '5.7/step-19';

// Exact in every context: SameSite and Secure are both in the line. The
// rule speaks only where this step is the one that ignores the cookie; a
// cookie a browser already ignored for its Domain or its connection is
// those rules'.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    const ignored = ignoredInStorage(cookie, exchange);
    return ignored?.step === STEP
      ? `A user agent ignores the cookie "${cookie.name}" entirely (${citeStep(STEP)}): ${ignored.reason}. Add the Secure attribute.`
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
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 19. If the cookie\'s "same-site-flag" is "None", abort this algorithm and ignore the cookie entirely unless the cookie\'s secure-only-flag is true.',
  )
  .summary(
    'User agent must ignore a SameSite=None cookie without the Secure attribute.',
  )
  .explanation(
    'SameSite=None asks the browser to send a cookie with cross-site requests too, which is what an embedded widget, a single sign-on flow or a cross-site API needs. Browsers accept that only for a cookie that is also Secure, and refuse one without it outright. The cookie the server set is silently dropped, and the cross-site flow it was meant for fails without a word. Add the Secure attribute, and set the cookie over https.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
