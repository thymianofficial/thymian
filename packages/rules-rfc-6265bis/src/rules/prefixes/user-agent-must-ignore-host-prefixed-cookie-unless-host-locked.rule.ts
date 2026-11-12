import { httpRule } from '@thymian/core';

import {
  cookieExchangeRuleFns,
  ignoredAtStep,
} from '../utils/exchange-contexts.js';

const NAME =
  'rfc-6265bis/user-agent-must-ignore-host-prefixed-cookie-unless-host-locked';

const STEP = '5.7/step-21';

// Exact in every context: the name and the attributes are in the line, and
// the prefix is matched case-insensitively (§5.4). A Path that does not
// start with "/" is the default-path of the request, which the described or
// sent path gives. The rule speaks only where this step is the one that
// ignores the cookie: one that also asks for SameSite=None without Secure
// is ignored at step 19 first.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  ignoredAtStep(
    STEP,
    'A __Host- cookie must have the Secure attribute, no Domain attribute and Path=/.',
  ),
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
    'When the user agent "receives a cookie" from a request-uri with name cookie-name, value cookie-value, and attributes cookie-attribute-list, the user agent MUST process the cookie as follows: [...] 21. If the cookie-name begins with a case-insensitive match for the string "__Host-", abort this algorithm and ignore the cookie entirely unless the cookie meets all the following criteria: 1. The cookie\'s secure-only-flag is true. 2. The cookie\'s host-only-flag is true. 3. The cookie-attribute-list contains an attribute with an attribute-name of "Path", and the cookie\'s path is /.',
  )
  .summary(
    'User agent must ignore a __Host- cookie unless it is Secure, has no Domain and has Path=/.',
  )
  .explanation(
    'A cookie name that starts with __Host- promises the server that the cookie is locked to the host that set it: set with Secure, without a Domain attribute, so no sibling subdomain can set or read it, and with Path=/, so no cookie for a narrower path can shadow it. A browser refuses to store a __Host- cookie that breaks any of the three, however the prefix is capitalized, and the cookie the server set is silently dropped. Remove the Domain attribute, set Path=/ and Secure, and set the cookie over https.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
