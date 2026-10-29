import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  citeStep,
  octets,
  onConformingLine,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/user-agent-must-replace-path-not-starting-with-slash';

// A path-value is any run of av-octets, so a line can conform to the grammar
// with a Path a user agent will not use. Only such a line is this rule's: on
// a line the grammar rejects, the grammar rule reports what the browser
// does. A Path past 1024 octets is ignored first, by the step its own rule
// reports.
const check = onConformingLine(({ name, attributes }) => {
  const replaced = attributes.filter(
    ({ name: attribute, value = '' }) =>
      attribute.toLowerCase() === 'path' &&
      !value.startsWith('/') &&
      octets(value) <= 1024,
  );

  return replaced.length === 0
    ? undefined
    : `The Set-Cookie line for the cookie "${name}" carries ${replaced
        .map(({ name: attribute, value = '' }) => `"${attribute}=${value}"`)
        .join(
          ', ',
        )}, which does not start with "/": a user agent replaces it with the default-path of the request (${citeStep('5.6.4/step-1')}), as if no Path were sent.`;
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
