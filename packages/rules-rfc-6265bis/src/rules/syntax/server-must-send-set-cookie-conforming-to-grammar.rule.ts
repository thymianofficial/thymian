import { httpRule } from '@thymian/core';

import { headerValueRuleFns } from '../utils/header-contexts.js';
import {
  hasCookiePrefix,
  readAsProducer,
  readAsUserAgent,
  type ReceivedCookie,
} from '../utils/set-cookie.js';

const NAME = 'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar';

// §5.7's steps that drop a received cookie for what the line alone shows.
// Steps 3 and 4 repeat §5.6's control-character and size checks, which an
// HTTP line has already passed by the time it is received.
function droppedOnReceipt(cookie: ReceivedCookie): string | undefined {
  if (cookie.name === '' && cookie.value === '') {
    return 'its name and value are both empty (§5.7 step 2)';
  }
  // §5.7 step 7: the last Domain attribute is the one that counts.
  const domain = cookie.attributes
    .filter((attribute) => attribute.name === 'Domain')
    .at(-1);
  // CHAR is %x01-7F, and §5.6 step 1 has already dropped a line holding
  // %x00, so what is left outside CHAR is a non-ASCII character.
  if (
    domain !== undefined &&
    [...domain.value].some((char) => char.charCodeAt(0) > 0x7f)
  ) {
    return 'its Domain holds a character outside US-ASCII (§5.7 step 8)';
  }
  if (
    cookie.name === '' &&
    (hasCookiePrefix(cookie.value, '__Secure-') ||
      hasCookiePrefix(cookie.value, '__Host-'))
  ) {
    return 'its name is empty and its value starts with a cookie name prefix (§5.7 step 22)';
  }
  return undefined;
}

// What a browser makes of a line the grammar rejects, from its own reading.
function consequence(line: string): string {
  const reading = readAsUserAgent(line);
  if (reading.ignored) {
    return `A user agent ignores the whole line, because ${reading.reason} (§${reading.step.replace('/step-', ' step ')}).`;
  }
  const dropped = droppedOnReceipt(reading.cookie);
  if (dropped !== undefined) {
    return `A user agent ignores the cookie, because ${dropped}.`;
  }
  if (reading.ignoredAttributes.length > 0) {
    return `A user agent ignores ${reading.ignoredAttributes
      .map(
        ({ cookieAv, step, reason }) =>
          `"${cookieAv}", because ${reason} (§${step.replace('/step-', ' step ')})`,
      )
      .join('; ')}.`;
  }
  return 'A user agent parses Set-Cookie more leniently than the grammar and may still store this cookie, but no cookie consumer is bound to read it as the server meant.';
}

// The one rule that owns a parse failure: every attribute-level rule runs
// only on a line that conforms, so a malformed line is reported once, here.
const { lint, live } = headerValueRuleFns('Set-Cookie', NAME, (line) => {
  const reading = readAsProducer(line);
  return reading.conforms
    ? undefined
    : `The Set-Cookie line "${line}" deviates from the draft-22 §4.1.1 grammar: ${reading.problem}. ${consequence(line)}`;
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
    'Browsers parse Set-Cookie far more leniently than servers may produce it, and where they cannot make sense of a line they drop it without a word: a control character, a nameless cookie or an oversized one loses the whole cookie, and an Expires that is no date or a Max-Age that is no number loses that attribute, so a cookie meant to expire becomes a session cookie or the reverse. Where the browser keeps a deviating line, what it stores may not be what the server meant. Every Set-Cookie line is a name, "=", a value of plain printable characters (encode arbitrary data, for example with Base64), and attributes separated by "; ", each in the form its definition gives, with Expires an IMF-fixdate such as "Wed, 09 Jun 2021 10:18:14 GMT".',
  )
  .appliesTo('server')
  // Value-blind common interface, so all three contexts are overridden: the
  // pinned value in `static` (an unpinned one is a `rule-skip`), the field
  // lines sent in `test` and `analytics`.
  .overrideStaticRule(lint)
  .overrideTest(live)
  .overrideAnalyticsRule(live)
  .done();
