import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  citeStep,
  onConformingLine,
  readAsUserAgent,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/user-agent-must-ignore-cookie-over-4096-octets';

// The grammar sets no length limit, so a line can conform to it and still
// be one a user agent ignores. Only such a line is this rule's: on a line
// the grammar rejects, the grammar rule reports what the browser does,
// this step included, so the defect is reported once.
const check = onConformingLine(({ name }, line) => {
  const reading = readAsUserAgent(line);
  return reading.ignored && reading.step === '5.6/step-5'
    ? `The Set-Cookie line for the cookie "${name}" is one a user agent ignores entirely, because ${reading.reason} (${citeStep(reading.step)}, and §5.7 step 4 for a cookie from any other source): the cookie is never set.`
    : undefined;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

// One rule for two units: §5.6 step 5 and §5.7 step 4 check the same sum,
// one on the line and one on the cookie received from it. A user agent
// following draft-22 must use an algorithm equivalent to §5.6's, so the step
// is a MUST, and exact: the sum is in the line.
export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.6',
  )
  .description(
    'A user agent MUST use an algorithm equivalent to the following algorithm to parse a set-cookie-string: [...] 5. If the sum of the lengths of the name string and the value string is more than 4096 octets, abort this algorithm and ignore the set-cookie-string entirely. (Section 5.7, step 4:) If the sum of the lengths of cookie-name and cookie-value is more than 4096 octets, abort this algorithm and ignore the cookie entirely.',
  )
  .summary(
    'User agent must ignore a cookie whose name and value exceed 4096 octets.',
  )
  .explanation(
    'A browser drops a Set-Cookie line whose cookie name and value add up to more than 4096 octets, without a word to the server or the user. The server believes it set the cookie, and every later request arrives without it: a session token that grew past the limit, such as a JWT carrying many claims, logs the user out on the next request, or never logs them in. Keep large state on the server and send an identifier for it, or split the value over several cookies that each stay under the limit.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
