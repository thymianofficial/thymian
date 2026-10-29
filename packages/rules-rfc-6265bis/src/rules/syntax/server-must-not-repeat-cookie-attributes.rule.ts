import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  receivedCookie,
  type SentCookieAv,
  sentCookieAvs,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/server-must-not-repeat-cookie-attributes';

// Every cookie-av counts, extension-avs included, and attribute names
// compare case-insensitively (§4.1.1's note). The grammar allows the
// repetition; this MUST forbids it.
//
// An attribute-level rule runs only on a line whose user-agent reading
// succeeded; one a user agent ignores is the grammar rule's alone. An empty
// cookie-av has no name to repeat, and the grammar rule reports it.
const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, (line) => {
  if (receivedCookie(line) === undefined) {
    return undefined;
  }
  const byName = new Map<string, SentCookieAv[]>();
  for (const cookieAv of sentCookieAvs(line)) {
    if (cookieAv.name !== '') {
      const key = cookieAv.name.toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), cookieAv]);
    }
  }
  const repeated = [...byName.values()]
    .filter((cookieAvs) => cookieAvs.length > 1)
    .map(
      (cookieAvs) =>
        `${cookieAvs[0]?.name} ${cookieAvs.length} times (${cookieAvs
          .map(({ text }) => `"${text.trim()}"`)
          .join(', ')})`,
    );

  return repeated.length === 0
    ? undefined
    : `The Set-Cookie line "${line}" carries the attribute ${repeated.join(' and ')}. Servers must not produce two attributes with the same name in one Set-Cookie line: of an attribute it recognizes, a user agent uses only the last, so the others have no effect.`;
});

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.1',
  )
  .description(
    'The portions of the set-cookie-string produced by the cookie-av term are known as attributes. To maximize compatibility with user agents, servers MUST NOT produce two attributes with the same name in the same set-cookie-string.',
  )
  .summary(
    'Server must not send two attributes with the same name in one Set-Cookie line.',
  )
  .explanation(
    'Two Path, Domain, Expires or SameSite attributes in one Set-Cookie line usually mean two layers each adding their own: a framework default and the application, or the application and a proxy. A browser uses only the last one, so which value takes effect depends on the order the layers wrote them in, and the one the developer configured may be the one that is ignored. Attribute names are compared without regard to case, so "Path" and "path" are the same attribute.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
