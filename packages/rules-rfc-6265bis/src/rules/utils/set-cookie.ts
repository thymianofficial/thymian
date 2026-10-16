// One Set-Cookie field line, read twice. Draft-22 splits its implementers
// (§3.2): a server must produce §4.1.1's grammar, and a user agent parses
// what it receives with §5.6's far more lenient algorithm. A rule judges the
// server by whichever reading its requirement is about:
//
// - the **producer reading** says whether the line conforms to §4.1.1's
//   grammar, and gives its first problem if not. The grammar rule owns
//   every parse failure, so a malformed line is reported once.
// - the **user-agent reading** gives the name, value and attributes a user
//   agent following §5.6 would record, and what it ignored and why. Rules on
//   a user-agent step use it: what the browser drops is visible on the
//   server's own message. An attribute-level rule runs only on a line whose
//   user-agent reading succeeded; one the user agent ignores entirely is the
//   grammar rule's alone.
//
// Each reading takes one field line. Several Set-Cookie lines on one
// response are read one by one, and nothing here splits a line on commas:
// an Expires date carries one.

// As a message spells it; header names compare case-insensitively.
export const SET_COOKIE_HEADER = 'Set-Cookie';

// A step id as the coverage record keys it, `5.6.2/step-3`, as prose cites
// it: `§5.6.2 step 3`.
export function citeStep(step: string): string {
  return `§${step.replace('/step-', ' step ')}`;
}

// The steps of §5.6 at which a user agent ignores the whole line.
export type IgnoredLineStep = '5.6/step-1' | '5.6/step-5';

// The steps of §5.6 and its subsections at which a user agent ignores one
// attribute and keeps the cookie.
export type IgnoredAttributeStep =
  | '5.6/step-6'
  | '5.6/step-7'
  | '5.6.1/step-2'
  | '5.6.2/step-1'
  | '5.6.2/step-2'
  | '5.6.2/step-3';

// An attribute as §5.6's subsections append it to the cookie-attribute-list.
// Expires and Max-Age carry the lifetime the server asked for, before the
// user agent's age limit reduces it (§5.5): that limit is the user agent's
// own, so the rule on it judges the lifetime, not this reading. Max-Age stays
// in seconds, since its expiry-time depends on when the cookie is received.
// A Path of `undefined` is the default-path of the request-uri (§5.6.4).
export type CookieAttribute =
  | { name: 'Expires'; value: Date }
  | { name: 'Max-Age'; value: number }
  | { name: 'Domain'; value: string }
  | { name: 'Path'; value: string | undefined }
  | { name: 'Secure' }
  | { name: 'HttpOnly' }
  | { name: 'SameSite'; value: 'Default' | 'None' | 'Strict' | 'Lax' };

// What a user agent "receives" (§5.6): the input to §5.7's storage model.
export type ReceivedCookie = {
  name: string;
  value: string;
  attributes: CookieAttribute[];
};

export type IgnoredAttribute = {
  // The cookie-av as the server sent it, without surrounding whitespace.
  cookieAv: string;
  step: IgnoredAttributeStep;
  reason: string;
};

// The steps of §5.7 at which a user agent ignores a cookie it received for
// what the line alone shows.
export type IgnoredCookieStep = '5.7/step-2' | '5.7/step-8' | '5.7/step-22';

export type UserAgentReading =
  | { ignored: true; step: IgnoredLineStep; reason: string }
  | {
      ignored: false;
      cookie: ReceivedCookie;
      ignoredAttributes: IgnoredAttribute[];
    };

// A cookie-av as the grammar reads it: the name and value as sent, without
// the whitespace the grammar allows around them. `value` is absent for an
// attribute without "=".
export type ProducedAttribute = { name: string; value?: string };

export type ProducerReading =
  | {
      conforms: true;
      name: string;
      value: string;
      attributes: ProducedAttribute[];
    }
  | { conforms: false; problem: string };

export type CookiePrefix = '__Secure-' | '__Host-';

// §5.4: user agents match a cookie name prefix case-insensitively, so a
// server that miscapitalizes one still gets the prefix's requirements.
export function hasCookiePrefix(text: string, prefix: CookiePrefix): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

// Lengths are in octets. A live field value arrives one octet per character;
// a value pinned by an API description is text, sent as UTF-8.
export function octets(text: string): number {
  return new TextEncoder().encode(text).length;
}

// WSP = SP / HTAB, the whitespace both readings strip.
function trimWsp(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/g, '');
}

function describeChar(char: string): string {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f
    ? `the control character %x${code.toString(16).padStart(2, '0').toUpperCase()}`
    : JSON.stringify(char);
}

// RFC 9110 §5.6.2: tchar, as a regular-expression character class.
export const TCHAR_CLASS = "[!#$%&'*+\\-.^_`|~0-9A-Za-z]";
const TCHAR = new RegExp(`^${TCHAR_CLASS}$`);

// cookie-octet = %x21 / %x23-2B / %x2D-3A / %x3C-5B / %x5D-7E
function isCookieOctet(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    code === 0x21 ||
    (code >= 0x23 && code <= 0x2b) ||
    (code >= 0x2d && code <= 0x3a) ||
    (code >= 0x3c && code <= 0x5b) ||
    (code >= 0x5d && code <= 0x7e)
  );
}

// av-octet = %x20-3A / %x3C-7E
function isAvOctet(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x20 && code <= 0x3a) || (code >= 0x3c && code <= 0x7e);
}

function firstOutside(
  text: string,
  allowed: (char: string) => boolean,
): string | undefined {
  return [...text].find((char) => !allowed(char));
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// §5.1.1: a cookie-date as a user agent parses it, or `undefined` where the
// algorithm fails.
export function parseCookieDate(text: string): Date | undefined {
  // delimiter = %x09 / %x20-2F / %x3B-40 / %x5B-60 / %x7B-7E
  const tokens = text
    .split(/[\t\x20-\x2f\x3b-\x40\x5b-\x60\x7b-\x7e]+/)
    .filter((token) => token !== '');

  let time: [number, number, number] | undefined;
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  for (const token of tokens) {
    const hms =
      time === undefined
        ? /^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\D[\s\S]*)?$/.exec(token)
        : null;
    if (hms !== null) {
      time = [Number(hms[1]), Number(hms[2]), Number(hms[3])];
      continue;
    }
    const dayOfMonth =
      day === undefined ? /^(\d{1,2})(?:\D[\s\S]*)?$/.exec(token) : null;
    if (dayOfMonth !== null) {
      day = Number(dayOfMonth[1]);
      continue;
    }
    const monthIndex =
      month === undefined
        ? MONTHS.indexOf(token.slice(0, 3).toLowerCase())
        : -1;
    if (monthIndex !== -1) {
      month = monthIndex;
      continue;
    }
    const yearDigits =
      year === undefined ? /^(\d{2,4})(?:\D[\s\S]*)?$/.exec(token) : null;
    if (yearDigits !== null) {
      year = Number(yearDigits[1]);
    }
  }

  if (
    time === undefined ||
    day === undefined ||
    month === undefined ||
    year === undefined
  ) {
    return undefined;
  }
  if (year >= 70 && year <= 99) {
    year += 1900;
  } else if (year >= 0 && year <= 69) {
    year += 2000;
  }
  const [hour, minute, second] = time;
  if (
    day < 1 ||
    day > 31 ||
    year < 1601 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return undefined;
  }

  // Step 6: no such date, such as 31 February, fails too.
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  return date.getUTCMonth() === month ? date : undefined;
}

// sane-cookie-date = IMF-fixdate (RFC 9110 §5.6.7), whose day-name, month
// and "GMT" are case-sensitive.
const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

// The producer reading goes one step past the ABNF here. An IMF-fixdate can
// still fail as a §5.1.1 cookie-date — a year before 1601, an hour of 24, a
// 31 February — and §5.6.1 step 2 then ignores the attribute. Such a date is
// rejected too, so the grammar rule owns that step without a second rule.
function checkExpires(value: string): string | undefined {
  if (!IMF_FIXDATE.test(value)) {
    return `the Expires value "${value}" is not an IMF-fixdate, such as "Wed, 09 Jun 2021 10:18:14 GMT"`;
  }
  return parseCookieDate(value) === undefined
    ? `the Expires value "${value}" is an IMF-fixdate a user agent cannot read as a cookie-date: it names no such date, an hour past 23, or a year before 1601`
    : undefined;
}

// domain-value = <subdomain> (RFC 1034 §3.5, as RFC 1123 §2.1 lets a label
// start with a digit): labels of letters, digits and hyphens, neither
// starting nor ending with a hyphen, of at most 63 characters, joined by ".".
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

function isSubdomain(text: string): boolean {
  return (
    text.length <= 255 &&
    text.split('.').every((label) => label.length <= 63 && LABEL.test(label))
  );
}

// What each attribute the draft defines requires of its cookie-av, as its
// own production reads it. A cookie-av whose name is a defined attribute is
// read against that attribute's production, never against extension-av,
// which would take nearly any text.
const DEFINED_ATTRIBUTES: Record<
  string,
  { valued: boolean; check?: (value: string) => string | undefined }
> = {
  expires: {
    valued: true,
    check: checkExpires,
  },
  'max-age': {
    valued: true,
    check: (value) =>
      /^[1-9][0-9]*$/.test(value)
        ? undefined
        : `the Max-Age value "${value}" is not a positive number of seconds without a leading zero (non-zero-digit *DIGIT)`,
  },
  domain: {
    valued: true,
    check: (value) =>
      isSubdomain(value)
        ? undefined
        : `the Domain value "${value}" is not a domain name of letters, digits and hyphens in dot-separated labels, without a leading or trailing "."`,
  },
  path: {
    valued: true,
    check: (value) => {
      const char = firstOutside(value, isAvOctet);
      return char === undefined
        ? undefined
        : `the Path value holds ${describeChar(char)}, which is not an av-octet`;
    },
  },
  secure: { valued: false },
  httponly: { valued: false },
  samesite: {
    valued: true,
    check: (value) =>
      ['strict', 'lax', 'none'].includes(value.toLowerCase())
        ? undefined
        : `the SameSite value "${value}" is none of Strict, Lax and None`,
  },
};

// Whether an attribute name is one the draft defines, compared
// case-insensitively; any other cookie-av is an extension-av.
export function isDefinedAttribute(name: string): boolean {
  return Object.hasOwn(DEFINED_ATTRIBUTES, name.toLowerCase());
}

// A cookie-av's name, as both readings take it: what precedes its first
// "=", or the whole cookie-av without one, trimmed.
export function attributeNameOf(cookieAv: string): string {
  const eq = cookieAv.indexOf('=');
  return trimWsp(eq === -1 ? cookieAv : cookieAv.slice(0, eq));
}

function readCookieAv(
  cookieAv: string,
): { attribute: ProducedAttribute } | { problem: string } {
  if (cookieAv === '') {
    return {
      problem: 'an attribute is empty, between two ";" or after the last one',
    };
  }

  const eq = cookieAv.indexOf('=');
  const name = attributeNameOf(cookieAv);
  const value = eq === -1 ? undefined : trimWsp(cookieAv.slice(eq + 1));
  const attribute = value === undefined ? { name } : { name, value };
  const defined = DEFINED_ATTRIBUTES[name.toLowerCase()];

  if (defined === undefined) {
    const char = firstOutside(cookieAv, isAvOctet);
    return char === undefined
      ? { attribute }
      : {
          problem: `the attribute "${cookieAv}" holds ${describeChar(char)}, so it is no extension-av`,
        };
  }
  if (!defined.valued) {
    return value === undefined
      ? { attribute }
      : { problem: `the ${name} attribute takes no value, but "=" follows it` };
  }
  if (value === undefined) {
    return { problem: `the ${name} attribute has no "=" and no value` };
  }
  const problem = defined.check?.(value);
  return problem === undefined ? { attribute } : { problem };
}

// §4.1.1:
//
//   set-cookie-string = BWS cookie-pair *( BWS ";" OWS cookie-av )
//   cookie-pair       = cookie-name BWS "=" BWS cookie-value
//   cookie-name       = token
//   cookie-value      = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )
//
// with every cookie-av read against its own production. Neither a
// cookie-octet nor an av-octet is ";", so the line splits on ";" exactly.
export function readAsProducer(line: string): ProducerReading {
  const fail = (problem: string): ProducerReading => ({
    conforms: false,
    problem,
  });

  // A field value carries no trailing whitespace (RFC 9110 §5.5).
  const [pair = '', ...cookieAvs] = line.replace(/[ \t]+$/, '').split(';');

  const eq = pair.indexOf('=');
  if (eq === -1) {
    return fail(
      `the cookie-pair "${trimWsp(pair)}" has no "=" between a name and a value`,
    );
  }

  const name = trimWsp(pair.slice(0, eq));
  if (name === '') {
    return fail(
      'the cookie-name is empty, and servers must not produce nameless cookies',
    );
  }
  const nameChar = firstOutside(name, (char) => TCHAR.test(char));
  if (nameChar !== undefined) {
    return fail(
      `the cookie-name "${name}" holds ${describeChar(nameChar)}, which is not a token character`,
    );
  }

  const value = trimWsp(pair.slice(eq + 1));
  const quoted = value.startsWith('"');
  if (quoted && (value.length < 2 || !value.endsWith('"'))) {
    return fail(
      `the cookie-value ${value} opens a DQUOTE that no DQUOTE closes`,
    );
  }
  const valueChar = firstOutside(
    quoted ? value.slice(1, -1) : value,
    isCookieOctet,
  );
  if (valueChar !== undefined) {
    return fail(
      `the cookie-value holds ${describeChar(valueChar)}, which is not a cookie-octet; arbitrary data must be encoded, for example with Base64`,
    );
  }

  const attributes: ProducedAttribute[] = [];
  for (const cookieAv of cookieAvs) {
    const read = readCookieAv(trimWsp(cookieAv));
    if ('problem' in read) {
      return fail(read.problem);
    }
    attributes.push(read.attribute);
  }

  return { conforms: true, name, value, attributes };
}

// §5.6.2 steps 1–3: Max-Age's delta-seconds, or the step that ignores it.
function readMaxAge(
  value: string,
): { seconds: number } | { step: IgnoredAttributeStep; reason: string } {
  if (value === '') {
    return { step: '5.6.2/step-1', reason: 'the Max-Age value is empty' };
  }
  if (!/^(?:[0-9]|-[0-9])/.test(value)) {
    return {
      step: '5.6.2/step-2',
      reason:
        'the Max-Age value starts with neither a digit nor "-" and a digit',
    };
  }
  if (!/^.[0-9]*$/.test(value)) {
    return {
      step: '5.6.2/step-3',
      reason: 'the Max-Age value holds a character other than a digit',
    };
  }
  return { seconds: Number.parseInt(value, 10) };
}

// §5.6.1–§5.6.7: one attribute's name and value, both trimmed, as the
// cookie-attribute-list records it, or the step that ignores it.
function receiveAttribute(
  name: string,
  value: string,
): CookieAttribute | { step: IgnoredAttributeStep; reason: string } {
  switch (name.toLowerCase()) {
    case 'expires': {
      const expiry = parseCookieDate(value);
      return expiry === undefined
        ? {
            step: '5.6.1/step-2',
            reason: 'the Expires value does not parse as a cookie-date',
          }
        : { name: 'Expires', value: expiry };
    }
    case 'max-age': {
      const maxAge = readMaxAge(value);
      return 'seconds' in maxAge
        ? { name: 'Max-Age', value: maxAge.seconds }
        : maxAge;
    }
    case 'domain':
      return {
        name: 'Domain',
        value: (value.startsWith('.') ? value.slice(1) : value).toLowerCase(),
      };
    case 'path':
      return {
        name: 'Path',
        value: value.startsWith('/') ? value : undefined,
      };
    case 'secure':
      return { name: 'Secure' };
    case 'httponly':
      return { name: 'HttpOnly' };
    case 'samesite': {
      const enforcement = (['None', 'Strict', 'Lax'] as const).find(
        (candidate) => candidate.toLowerCase() === value.toLowerCase(),
      );
      return { name: 'SameSite', value: enforcement ?? 'Default' };
    }
    default:
      return {
        step: '5.6/step-7',
        reason: `a user agent does not recognize the attribute name "${name}"`,
      };
  }
}

// §5.6: the set-cookie-string algorithm, then the unparsed-attributes one.
export function readAsUserAgent(line: string): UserAgentReading {
  // Step 1. HTAB is whitespace, not one of the controls.
  const control = [...line].find((char) => {
    const code = char.charCodeAt(0);
    return (code < 0x20 && code !== 0x09) || code === 0x7f;
  });
  if (control !== undefined) {
    return {
      ignored: true,
      step: '5.6/step-1',
      reason: `the line holds ${describeChar(control)}`,
    };
  }

  // Steps 2–4.
  const semicolon = line.indexOf(';');
  const pair = semicolon === -1 ? line : line.slice(0, semicolon);
  const unparsed = semicolon === -1 ? '' : line.slice(semicolon + 1);
  const eq = pair.indexOf('=');
  const name = eq === -1 ? '' : trimWsp(pair.slice(0, eq));
  const value = trimWsp(eq === -1 ? pair : pair.slice(eq + 1));

  // Step 5.
  const size = octets(name) + octets(value);
  if (size > 4096) {
    return {
      ignored: true,
      step: '5.6/step-5',
      reason: `the cookie's name and value are ${size} octets together, more than 4096`,
    };
  }

  const attributes: CookieAttribute[] = [];
  const ignoredAttributes: IgnoredAttribute[] = [];
  for (const rawCookieAv of semicolon === -1 ? [] : unparsed.split(';')) {
    const cookieAv = trimWsp(rawCookieAv);
    const avEq = rawCookieAv.indexOf('=');
    const attributeName = attributeNameOf(rawCookieAv);
    const attributeValue =
      avEq === -1 ? '' : trimWsp(rawCookieAv.slice(avEq + 1));

    const valueSize = octets(attributeValue);
    if (valueSize > 1024) {
      ignoredAttributes.push({
        cookieAv,
        step: '5.6/step-6',
        reason: `the attribute value is ${valueSize} octets, more than 1024`,
      });
      continue;
    }

    const received = receiveAttribute(attributeName, attributeValue);
    if ('step' in received) {
      ignoredAttributes.push({ cookieAv, ...received });
    } else {
      attributes.push(received);
    }
  }

  return {
    ignored: false,
    cookie: { name, value, attributes },
    ignoredAttributes,
  };
}

// §5.7: whether a user agent ignores a received cookie for what the line
// alone shows, and by which step. Steps 3 and 4 repeat §5.6's control and
// size checks, which a line received over HTTP has already passed; the
// steps that need the request, the connection or the cookie store are
// left to the rules on them.
export function ignoredOnReceipt(
  cookie: ReceivedCookie,
): { step: IgnoredCookieStep; reason: string } | undefined {
  if (cookie.name === '' && cookie.value === '') {
    return {
      step: '5.7/step-2',
      reason: 'its name and value are both empty',
    };
  }
  // Step 7: the last Domain attribute is the one that counts.
  const domain = cookie.attributes
    .filter((attribute) => attribute.name === 'Domain')
    .at(-1);
  // CHAR is %x01-7F, and §5.6 step 1 has already ignored a line holding
  // %x00, so what is left outside CHAR is a non-ASCII character.
  if (
    domain !== undefined &&
    [...domain.value].some((char) => char.charCodeAt(0) > 0x7f)
  ) {
    return {
      step: '5.7/step-8',
      reason: 'its Domain holds a character outside US-ASCII',
    };
  }
  if (
    cookie.name === '' &&
    (hasCookiePrefix(cookie.value, '__Secure-') ||
      hasCookiePrefix(cookie.value, '__Host-'))
  ) {
    return {
      step: '5.7/step-22',
      reason:
        'its name is empty and its value starts with a cookie name prefix',
    };
  }
  return undefined;
}

// The cookie a user agent keeps from one line, for what the line alone
// shows: its user-agent reading, unless §5.6 ignores the line or §5.7 the
// cookie on receipt. A rule on one attribute, or on the cookie-names of a
// response, reads only such a line; one a user agent ignores entirely is the
// grammar rule's alone, so its defect is reported once.
export function receivedCookie(line: string): ReceivedCookie | undefined {
  const reading = readAsUserAgent(line);
  if (reading.ignored || ignoredOnReceipt(reading.cookie) !== undefined) {
    return undefined;
  }
  return reading.cookie;
}

// The lifetime a cookie asks for, before any user agent's age limit: the
// last Max-Age, which wins over any Expires, or else the last Expires
// (§5.7 step 6), in seconds from `now`, and the attribute it came from.
// `undefined` is a session cookie; zero or less removes the cookie.
export type RequestedLifetime = {
  attribute: 'Max-Age' | 'Expires';
  seconds: number;
};

export function requestedLifetime(
  { attributes }: ReceivedCookie,
  now: number,
): RequestedLifetime | undefined {
  const maxAge = attributes
    .filter((attribute) => attribute.name === 'Max-Age')
    .at(-1);
  if (maxAge !== undefined) {
    return { attribute: 'Max-Age', seconds: maxAge.value };
  }
  const expires = attributes
    .filter((attribute) => attribute.name === 'Expires')
    .at(-1);
  return expires === undefined
    ? undefined
    : {
        attribute: 'Expires',
        seconds: (expires.value.getTime() - now) / 1000,
      };
}

// The attributes a user agent ignores at one step of §5.6 on a line it
// keeps; none on a line it ignores entirely, which sets no cookie.
export function attributesIgnoredAt(
  line: string,
  step: IgnoredAttributeStep,
): IgnoredAttribute[] {
  const reading = readAsUserAgent(line);
  return reading.ignored
    ? []
    : reading.ignoredAttributes.filter((ignored) => ignored.step === step);
}

// A cookie-av as the server wrote it. `text` keeps the whitespace around
// it; `name` is what precedes its first "=", trimmed, as §5.6 reads it.
export type SentCookieAv = { text: string; name: string };

// The cookie-avs of one line, split as both readings split it: on every ";"
// after the cookie-pair. The last loses its trailing whitespace, which is no
// part of a field value (RFC 9110 §5.5).
export function sentCookieAvs(line: string): SentCookieAv[] {
  const [, ...cookieAvs] = line.replace(/[ \t]+$/, '').split(';');
  return cookieAvs.map((text) => ({ text, name: attributeNameOf(text) }));
}

// Checks one Set-Cookie line; returns a violation message, or undefined.
export type SetCookieLineCheck = (line: string) => string | undefined;

// One defect, one violation: the grammar rule owns parse failures, so every
// other rule on a line names which lines it leaves to it. These two wrappers
// are the only two answers, so the policy is stated once.
//
// A rule on the cookie a user agent keeps — its attributes, its name — runs
// only on a line whose user-agent reading succeeded and whose cookie §5.7
// does not ignore on receipt. A line the user agent ignores sets no cookie.
export function onReceivedCookie(
  check: (cookie: ReceivedCookie, line: string) => string | undefined,
): SetCookieLineCheck {
  return (line) => {
    const cookie = receivedCookie(line);
    return cookie === undefined ? undefined : check(cookie, line);
  };
}

// A rule on a form the grammar itself defines, or one whose evidence the
// grammar would otherwise also report, runs only on a line the grammar
// accepts.
export function onConformingLine(
  check: (
    reading: Extract<ProducerReading, { conforms: true }>,
    line: string,
  ) => string | undefined,
): SetCookieLineCheck {
  return (line) => {
    const reading = readAsProducer(line);
    return reading.conforms ? check(reading, line) : undefined;
  };
}
