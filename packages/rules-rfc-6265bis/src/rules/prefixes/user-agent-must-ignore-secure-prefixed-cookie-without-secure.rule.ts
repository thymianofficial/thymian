import { httpRule } from '@thymian/core';

import {
  cookieExchangeRuleFns,
  ignoredAtStep,
} from '../utils/exchange-contexts.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-secure-prefixed-cookie-without-secure';

const STEP = '5.7/step-20';

// Exact in every context: the name and the attributes are in the line, and
// the prefix is matched case-insensitively (§5.4). The rule speaks only where
// this step is the one that ignores the cookie: one that also asks for
// SameSite=None is ignored at step 19 first, for the same missing Secure.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  ignoredAtStep(STEP, 'Add the Secure attribute.'),
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
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 20. If the cookie-name begins with a case-insensitive match for the string "__Secure-", abort this algorithm and ignore the cookie entirely unless the cookie\'s secure-only-flag is true.',
  )
  .summary(
    'User agent must ignore a __Secure- cookie without the Secure attribute.',
  )
  .explanation(
    'A cookie name that starts with __Secure- promises the server that the cookie was set with the Secure attribute, so a browser refuses to store one without it, however the prefix is capitalized. The cookie the server set is silently dropped: requests arrive without it, and whatever relies on it, such as a session, never starts. Add the Secure attribute, and set the cookie over https.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
