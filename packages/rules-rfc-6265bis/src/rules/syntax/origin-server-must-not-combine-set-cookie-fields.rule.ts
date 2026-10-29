import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import { readAsProducer, SET_COOKIE_HEADER } from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/origin-server-must-not-combine-set-cookie-fields';

// A comma followed by a token and "=", which reads as the cookie-pair of a
// second Set-Cookie field joined on with HTTP's usual ", ". An Expires date
// carries a comma too, but what follows it is a day of the month, never "=".
const SECOND_COOKIE_PAIR = /,[ \t]*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[ \t]*=/;

// Heuristic: the comma is the only trace of combining, and a comma inside an
// attribute value reads the same — the draft's own `a=b;path=/c,d=e` is
// either two cookies or one cookie with the path "/c,d=e".
//
// One defect, one violation: a line the grammar rejects is the grammar
// rule's alone. Combining that puts the comma in the cookie-value, as in
// `a=b, c=d`, fails `cookie-octet`, so it is reported there; what is left
// here is the comma inside an attribute, which the grammar's av-octet allows.
const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, (line) => {
  if (!readAsProducer(line).conforms) {
    return undefined;
  }
  const semicolon = line.indexOf(';');
  const match =
    semicolon === -1
      ? null
      : SECOND_COOKIE_PAIR.exec(line.slice(semicolon + 1));
  return match === null
    ? undefined
    : `The Set-Cookie line "${line}" carries a comma followed by "${match[1]}=", which reads as a second cookie: it looks like several Set-Cookie header fields combined into one. A user agent reads the line as one cookie, with the rest as part of an attribute, so a second cookie it may hold is never stored.`;
});

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
