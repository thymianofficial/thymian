import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  citeStep,
  ignoredOnReceipt,
  type ProducedAttribute,
  quote,
  readAsProducer,
  readAsUserAgent,
  SET_COOKIE_HEADER,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';

// What a browser makes of a line the grammar rejects, from its own reading.
function consequence(line: string, cookieAv?: ProducedAttribute): string {
  const reading = readAsUserAgent(line);
  if (reading.ignored) {
    return `A user agent ignores the whole line, because ${reading.reason} (${citeStep(reading.step)}).`;
  }
  const dropped = ignoredOnReceipt(reading.cookie);
  if (dropped !== undefined) {
    return `A user agent ignores the cookie, because ${dropped.reason} (${citeStep(dropped.step)}).`;
  }
  // A trailing or doubled ";" leaves an empty cookie-av, which names nothing.
  const ignored = reading.ignoredAttributes.filter(
    ({ cookieAv }) => cookieAv !== '',
  );
  if (ignored.length > 0) {
    return `A user agent ignores ${ignored
      .map(
        ({ cookieAv, step, reason }) =>
          `${quote(cookieAv)}, because ${reason} (${citeStep(step)})`,
      )
      .join('; ')}.`;
  }
  // A common legacy way to delete a cookie: the last Max-Age counts (§5.7).
  const maxAge = reading.cookie.attributes
    .filter((attribute) => attribute.name === 'Max-Age')
    .at(-1);
  if (maxAge !== undefined && maxAge.value <= 0) {
    return 'A user agent removes the cookie at once (§5.6.2 step 7); to delete a cookie within the grammar, send "Expires=Thu, 01 Jan 1970 00:00:00 GMT".';
  }
  // A common legacy Domain form, from before the leading dot was dropped.
  if (
    cookieAv?.name.toLowerCase() === 'domain' &&
    cookieAv.value?.startsWith('.')
  ) {
    return 'A user agent ignores the leading "." of the Domain value (§5.6.3), so drop it.';
  }
  return 'A user agent parses Set-Cookie more leniently than the grammar and may still store this cookie, but no cookie consumer is bound to read it as the server meant.';
}

// The one rule that owns a parse failure, so a malformed line is reported
// once, here. Every attribute-level rule runs only on a line whose
// user-agent reading succeeded.
const { lint, live } = headerValueRuleFns(SET_COOKIE_HEADER, NAME, (line) => {
  const reading = readAsProducer(line);
  return reading.conforms
    ? undefined
    : `The Set-Cookie line ${quote(line)} deviates from the draft-22 §4.1.1 grammar: ${reading.problem}. ${consequence(line, reading.cookieAv)}`;
});

export default httpRule(NAME)
  .severity('error')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-4.1.1',
  )
  .description(
    'Servers conforming to this profile MUST NOT send Set-Cookie header fields that deviate from the following grammar: set-cookie-string = BWS cookie-pair *( BWS ";" OWS cookie-av ).',
  )
  .summary(
    'Server must send Set-Cookie lines that conform to the draft-22 grammar.',
  )
  .explanation(
    'Browsers parse Set-Cookie far more leniently than servers may produce it, and where they cannot make sense of a line they drop it without a word: a control character, a nameless cookie or an oversized one loses the whole cookie, and an Expires that is no date or a Max-Age that is no number loses that attribute, so a cookie meant to expire becomes a session cookie or the reverse. Where the browser keeps a deviating line, what it stores may not be what the server meant. Every Set-Cookie line is a name, "=", a value of plain printable characters (encode arbitrary data, for example with Base64), and attributes separated by "; ", each in the form its definition gives, with Expires an IMF-fixdate such as "Wed, 09 Jun 2021 10:18:14 GMT". Two common legacy forms deviate as well: a Max-Age of 0 or less, which a browser takes as removing the cookie at once (to delete a cookie within the grammar, send an Expires in the past, such as "Thu, 01 Jan 1970 00:00:00 GMT"), and a Domain with a leading ".", which a browser ignores, so drop it.',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
