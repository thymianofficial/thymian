import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  combinedCookieName,
  onReceivedCookie,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/origin-server-must-not-combine-set-cookie-fields';

// Heuristic: the comma is the only trace of combining, and a comma inside an
// attribute value reads the same — the draft's own `a=b;path=/c,d=e` is
// either two cookies or one cookie with the path "/c,d=e".
//
// It reads only the cookie a user agent keeps; a line it ignores is the
// grammar rule's alone. Combining that puts the comma in the cookie-value,
// as in `a=b, c=d`, fails `cookie-octet` and is never searched. A comma in
// a Path or an extension-av is one the grammar's av-octet allows; one in the
// value of SameSite, Expires, Max-Age or Domain breaks that attribute's
// production, so the grammar rule reports the broken value and this rule
// the combining behind it, the way a repeated attribute on a line the
// grammar rejects is reported by its own rule too.
const check = onReceivedCookie((_cookie, line) => {
  const name = combinedCookieName(line);
  return name === undefined
    ? undefined
    : `The Set-Cookie line "${line}" carries a comma followed by "${name}=", which reads as a second cookie: it looks like several Set-Cookie header fields combined into one. A user agent reads the line as one cookie, with the rest as part of an attribute, which may make that attribute invalid, so a second cookie it may hold is never stored.`;
});

const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, check);

export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-3',
  )
  .description(
    'Origin servers and intermediaries MUST NOT combine multiple Set-Cookie header fields into a single header field. The usual mechanism for combining HTTP headers fields (i.e., as defined in Section 5.3 of [HTTP]) might change the semantics of the Set-Cookie header field because the %x2C (",") character is used by Set-Cookie in a way that conflicts with such combining.',
  )
  .summary(
    'Origin server must not combine several Set-Cookie header fields into one.',
  )
  .explanation(
    'HTTP lets most repeated header fields be joined into one, separated by commas, but not Set-Cookie: a comma is part of an Expires date and may be part of an attribute value, so a browser never splits a Set-Cookie line on commas. A proxy, framework or header map that joins two Set-Cookie fields turns them into one cookie whose last attribute swallows the second, and the second cookie is silently lost. Send every cookie in a Set-Cookie field of its own. This rule is a warning, not an error, because a comma inside an attribute value looks the same.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
