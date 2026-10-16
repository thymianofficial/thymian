import { httpRule } from '@thymian/core';

import { cookieExchangeRuleFns } from '../utils/exchange-contexts.js';
import { removesCookie } from '../utils/set-cookie.js';
import { ignoredInStorage } from '../utils/storage-model.js';

const NAME = 'rfc-6265bis/server-should-encrypt-and-sign-cookie-contents';

// Somewhere in the value: a local part, "@", and a domain with a top-level
// label of letters.
const EMAIL_ADDRESS =
  /[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

// One `key=value` or `key:value` pair, its key starting with a letter or "_"
// and its value not empty, so Base64 padding at the end of a value is none.
const PAIR = '[A-Za-z_][\\w.-]*[=:][^=:&|]+';
// Two pairs or more, joined by "&" or "|", such as `uid=42&role=admin`.
const PAIRS = new RegExp(`^${PAIR}(?:[&|]${PAIR})+$`);
// One pair with "=", such as `user=alice`. A single `key:value` is left out:
// `s:` and `v1:` are how signed and versioned tokens start.
const ONE_ASSIGNMENT = /^[A-Za-z_][\w.-]*=[^=:&|]+$/;

// The value as a reader of the cookie sees it: without the optional DQUOTEs,
// and percent-decoded, since a cookie-value cannot carry a raw DQUOTE, comma
// or whitespace and JSON in a cookie is percent-encoded.
function decoded(value: string): string {
  const unquoted =
    value.length >= 2 && value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value;
  try {
    return decodeURIComponent(unquoted);
  } catch {
    return unquoted;
  }
}

function isJsonStructure(text: string): boolean {
  if (!/^\s*[[{]/.test(text)) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

// What makes a value legible, or `undefined` for one that is not: structured
// data anyone can read, and so alter, without a key.
function legibleContents(value: string): string | undefined {
  const text = decoded(value);
  if (isJsonStructure(text)) {
    return 'a JSON document';
  }
  if (EMAIL_ADDRESS.test(text)) {
    return 'an email address';
  }
  if (PAIRS.test(text) || ONE_ASSIGNMENT.test(text)) {
    return 'key-value pairs';
  }
  return undefined;
}

// Heuristic in every context: an encrypted value and an opaque one, such as
// a random session identifier, look alike, and both pass. Only a value whose
// contents anyone can read is flagged — a JSON document, an email address, or
// key-value pairs, as they are or percent-encoded — and a short word such as
// a language tag is not, so the rule errs towards passing. A line that clears
// its cookie, and a cookie a browser ignores, which the rule on why reports,
// are left out.
const { lint, test, analytics } = cookieExchangeRuleFns(
  NAME,
  (cookie, exchange) => {
    if (
      removesCookie(cookie, exchange.responseDate) ||
      ignoredInStorage(cookie, exchange) !== undefined
    ) {
      return undefined;
    }
    const contents = legibleContents(cookie.value);
    return contents === undefined
      ? undefined
      : `The value of the cookie "${cookie.name}" is legible: it holds ${contents}, which anyone who sees the cookie can read and the user can alter (§8.3). Encrypt and sign the contents of the cookie, or keep the data on the server and set an opaque session identifier instead.`;
  },
);

// A SHOULD, so a `warn`.
export default httpRule(NAME)
  .severity('warn')
  .type('static', 'test', 'analytics')
  .tags('security:cookies')
  .url(
    'https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-22#section-8.3',
  )
  .description(
    'Servers SHOULD encrypt and sign the contents of cookies (using whatever format the server desires) when transmitting them to the user agent (even when sending the cookies over a secure channel).',
  )
  .summary('Server should encrypt and sign the contents of its cookies.')
  .explanation(
    'A browser stores a cookie as the server sent it, and the user, other software on the device, and anyone who intercepts the cookie can read it and change it before it is sent back. A cookie that carries a user id, a role or a profile in plain text both discloses that data and invites the user to edit it. Encrypt and sign cookie contents, or keep the data on the server behind an opaque session identifier. This rule is a warning that flags only contents that are plainly legible, such as JSON, an email address or key-value pairs, because an encrypted value and a random one look alike.',
  )
  .appliesTo('server')
  .overrideStaticRule(lint)
  .overrideTest(test)
  .overrideAnalyticsRule(analytics)
  .done();
