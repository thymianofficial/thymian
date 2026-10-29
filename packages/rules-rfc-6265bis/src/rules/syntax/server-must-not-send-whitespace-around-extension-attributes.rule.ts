import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  isDefinedAttribute,
  receivedCookie,
  sentCookieAvs,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME =
  'rfc-6265bis/server-must-not-send-whitespace-around-extension-attributes';

// Exact on the trailing side only. The grammar puts OWS between ";" and a
// cookie-av, so whitespace before an extension-av reads as that OWS, the
// conventional "; " included, and is no evidence of leading whitespace.
// Whitespace after one, before the next ";", is BWS, which a sender never
// generates (RFC 9110 §5.6.3): the server meant it as part of the attribute.
// After the last attribute it is no part of the field value at all.
//
// An attribute-level rule runs only on a line whose user-agent reading
// succeeded; one a user agent ignores is the grammar rule's alone. A
// cookie-av that is nothing but whitespace is no extension-av, and the
// grammar rule reports the empty attribute.
const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, (line) => {
  if (receivedCookie(line) === undefined) {
    return undefined;
  }
  const padded = sentCookieAvs(line)
    .filter(
      ({ text, name }) =>
        /\S/.test(text) && /[ \t]$/.test(text) && !isDefinedAttribute(name),
    )
    .map(({ text }) => `"${text.trim()}"`);

  return padded.length === 0
    ? undefined
    : `The Set-Cookie line "${line}" has whitespace after the extension attribute ${padded.join(', ')}, before the ";" that ends it. An extension-av must not end in whitespace: draft-22 reads it as BWS and a user agent removes it, so the attribute is not received as written.`;
});

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.1',
  )
  .description(
    'Per the grammar above, extension-av MUST NOT contain leading or trailing WSP characters as they will be interpreted as BWS and removed.',
  )
  .summary(
    'Server must not send whitespace around an extension attribute of Set-Cookie.',
  )
  .explanation(
    'An attribute the draft does not define, such as Partitioned or Priority, is passed through as an extension attribute. Whitespace between it and the ";" that follows is not part of it: a browser strips it, so an attribute whose value ends in a space arrives without the space, and code that compares it to what the server meant may disagree. Write "; Name=value;" with no space before the next ";".',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
