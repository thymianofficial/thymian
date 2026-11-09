import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  citeStep,
  octets,
  onReceivedCookie,
  sentCookieAvs,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/user-agent-must-replace-path-not-starting-with-slash';

// A path-value is any run of av-octets, so even a line that conforms to the
// grammar can carry a Path a user agent will not use. The rule reads the
// cookie a user agent keeps, whether or not the grammar accepts its line:
// the grammar rule's message says what the browser does with a malformed
// line, never what it does with a relative Path, so the two report
// different defects. A line the user agent ignores entirely sets no cookie.
//
// The cookie keeps the last Path a user agent read (§5.7 step 11), so only
// that one counts: an earlier one has no effect, relative or not. A Path
// past 1024 octets is ignored before it is read, by the step its own rule
// reports, so it is not the one kept.
const check = onReceivedCookie((cookie, line) => {
  const kept = cookie.attributes
    .filter((attribute) => attribute.name === 'Path')
    .at(-1);
  if (kept?.value !== undefined) {
    return undefined;
  }
  const sent = sentCookieAvs(line)
    .filter(
      ({ name, text }) =>
        name.toLowerCase() === 'path' &&
        octets(text.slice(text.indexOf('=') + 1).trim()) <= 1024,
    )
    .at(-1);

  return sent === undefined
    ? undefined
    : `The Set-Cookie line for the cookie "${cookie.name}" carries "${sent.text.trim()}", which does not start with "/": a user agent replaces it with the default-path of the request (${citeStep('5.6.4/step-1')}), as if no Path were sent.`;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

// A user agent MUST process a Path cookie-av as §5.6.4 says, and the step is
// exact: whether the value starts with "/" is in the line.
export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-5.6.4',
  )
  .description(
    'If the attribute-name case-insensitively matches the string "Path", the user agent MUST process the cookie-av as follows. 1. If the attribute-value is empty or if the first character of the attribute-value is not %x2F ("/"): Let cookie-path be the default-path.',
  )
  .summary(
    'User agent must replace a Path that does not start with "/" with the default-path.',
  )
  .explanation(
    'A browser uses a Path only if it starts with "/". An empty or relative Path, such as "Path=docs", is replaced with the default-path, the directory of the request that set the cookie, without a word to the server. The cookie is stored as if no Path had been sent: it may be sent to more paths than the server meant, or to fewer. Write every Path as an absolute path, such as "Path=/docs".',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
