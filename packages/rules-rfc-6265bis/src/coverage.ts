// Draft-22's denominator (ADR-0021 §5). The draft splits its implementers
// itself (§3.2): a cookie-producing implementation follows §4, a consuming
// one §5. The unit is therefore a keyword paragraph that binds the producer
// — the server Thymian checks — wherever it stands, plus every step of the
// user agent's own algorithms at which a browser discards or caps what a
// server sent. Such a step binds the browser, but its consequence is visible
// on the server's message: a cookie the server believes it set is never
// stored, or is stored without an attribute, or with a shorter lifetime.
//
// Counted from the document, never from the rules: derived by splitting
// https://www.ietf.org/archive/id/draft-ietf-httpbis-rfc6265bis-22.txt into
// paragraphs, dropping page headers and footers, and joining a paragraph a
// page break splits.
//
// - Keyword paragraphs: 81 paragraphs contain at least one of MUST, MUST
//   NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT
//   RECOMMENDED, MAY or OPTIONAL. 25 bind a server: their subject is
//   servers or origin servers, or they name no actor and bind whoever
//   produces the cookie (3/3: a cookie's octets are US-ASCII). Not keyword
//   units: §2.1's two paragraphs, which define the keywords; every paragraph
//   whose subject is the user agent, a registrant (§9.3.1) or a user, or
//   that names no actor but refers to the user agent's own requirements
//   (§6.1's "length limits which MUST be enforced in Section 5.6"); and the
//   one in §4.1.2.1, under §4.1.2 "Semantics (Non-Normative)".
// - User-agent steps: 26, of which 24 are numbered steps of the algorithms
//   in §5.5–§5.7 and two are unnumbered paragraphs of them (5.5/1, 5.6/1).
//   Each tells the user agent to ignore a cookie or one of its attributes,
//   or to reduce a value to a limit. Not counted:
//   §5.7 steps 15 and 23, which ignore only what came through a non-HTTP
//   API; steps that pick the last of several attributes, or substitute a
//   default value, without ignoring the attribute; and the eviction
//   paragraphs after §5.7's algorithm, which act on the store at any time,
//   not on a cookie as it is received.
//
// N = 51. A unit's id is re-derivable from the counting rule alone: a
// keyword paragraph is `<section>/<n>`, n its position among that section's
// units; an algorithm step is `<section>/step-<k>`, k the draft's own step
// number; an unnumbered step paragraph is `<section>/<n>` like a keyword
// paragraph. §5.6 holds two algorithms: steps 1 and 5 are the
// set-cookie-string algorithm's, steps 6 and 7 the unparsed-attributes
// algorithm's, and no step number is a unit in both.
//
// The per-rule entries arrive with the rules, grouped by the topic directory
// the rule lives in; a unit no entry covers renders as not yet covered.

import { defineCoverage } from '@thymian/core';

const units = {
  '1/1':
    "Servers SHOULD limit themselves to Section 4's well-behaved profile when generating cookies.",
  '3/1':
    'Origin servers MAY send a Set-Cookie response header field with any response.',
  '3/2':
    'Origin servers and intermediaries MUST NOT combine multiple Set-Cookie header fields into a single header field.',
  '3/3': "A cookie's octets MUST be processed as US-ASCII characters.",
  '4.1.1/1':
    'Servers MUST NOT send Set-Cookie header fields that deviate from the set-cookie-string grammar.',
  '4.1.1/2':
    'Servers MUST NOT produce nameless cookies (an empty cookie-name).',
  '4.1.1/3':
    'Servers that wish to store arbitrary data in a cookie-value SHOULD encode that data, for example using Base64.',
  '4.1.1/4': 'The cookie-value MAY be wrapped in DQUOTE characters.',
  '4.1.1/5':
    'An extension-av MUST NOT contain leading or trailing WSP characters, which are interpreted as BWS and removed.',
  '4.1.1/6':
    'Servers MUST NOT produce two attributes with the same name in the same set-cookie-string.',
  '4.1.1/7':
    'Servers MUST NOT include more than one Set-Cookie header field in the same response with the same cookie-name.',
  '4.1.1/8':
    'Servers SHOULD use the rfc1123-date format, with a four-digit year, for dates.',
  '4.1.3/1':
    'Servers SHOULD use the `__Secure-` and `__Host-` cookie name prefixes.',
  '4.2.1/1':
    'Servers SHOULD avoid setting so many large cookies that the final cookie-string exceeds their header field limit.',
  '4.2.1/2': 'Servers MUST be tolerant of multiple Cookie header fields.',
  '4.2.2/1':
    'Servers SHOULD NOT rely upon the order in which cookies are serialized in the Cookie header field.',
  '5.5/1':
    'A user agent MUST limit the maximum age of a cookie, a limit that SHOULD NOT exceed 400 days, and MUST reduce a longer Expires or Max-Age lifetime to the limit.',
  '5.6/1':
    'A user agent MAY ignore a Set-Cookie header field in its entirety, such as one in a 1xx response.',
  '5.6/step-1':
    'A user agent ignores a set-cookie-string that contains a control character other than HTAB.',
  '5.6/step-5':
    'A user agent ignores a set-cookie-string whose name and value together exceed 4096 octets.',
  '5.6/step-6':
    'A user agent ignores an attribute whose value is longer than 1024 octets.',
  '5.6/step-7':
    'A user agent ignores an attribute whose name it does not recognize.',
  '5.6.1/step-2':
    'A user agent ignores an Expires attribute whose value fails to parse as a cookie-date.',
  '5.6.1/step-4':
    "A user agent MUST reduce an Expires expiry-time later than the cookie's age limit to that limit.",
  '5.6.2/step-1':
    'A user agent ignores a Max-Age attribute whose value is empty.',
  '5.6.2/step-2':
    'A user agent ignores a Max-Age attribute whose value starts with neither a DIGIT nor "-" followed by a DIGIT.',
  '5.6.2/step-3':
    'A user agent ignores a Max-Age attribute whose value contains a non-DIGIT after its first character.',
  '5.6.2/step-6':
    "A user agent reduces a Max-Age delta-seconds to the cookie's age limit.",
  '5.7/step-1': 'A user agent MAY ignore a received cookie in its entirety.',
  '5.7/step-2':
    'A user agent ignores a cookie whose name and value are both empty.',
  '5.7/step-3':
    'A user agent ignores a cookie whose name or value contains a control character other than HTAB.',
  '5.7/step-4':
    'A user agent ignores a cookie whose name and value together exceed 4096 octets.',
  '5.7/step-8':
    'A user agent ignores a cookie whose Domain attribute contains a character outside CHAR.',
  '5.7/step-9':
    'A user agent configured to reject public suffixes ignores a cookie whose Domain attribute is a public suffix other than the request host.',
  '5.7/step-10':
    'A user agent ignores a cookie whose Domain attribute the request host does not domain-match.',
  '5.7/step-13':
    'A user agent ignores a cookie with the Secure attribute that was received over a non-secure connection.',
  '5.7/step-16':
    'A user agent ignores a non-Secure cookie received over a non-secure connection that would overlay a stored Secure cookie of the same name.',
  '5.7/step-18':
    'A user agent ignores a cookie whose SameSite is not None when it was set by a cross-site request that is not a top-level navigation.',
  '5.7/step-19':
    'A user agent ignores a cookie with SameSite=None unless it has the Secure attribute.',
  '5.7/step-20':
    'A user agent ignores a cookie whose name begins with `__Secure-`, matched case-insensitively, unless it has the Secure attribute.',
  '5.7/step-21':
    'A user agent ignores a cookie whose name begins with `__Host-`, matched case-insensitively, unless it is Secure, host-only, and has a Path attribute of "/".',
  '5.7/step-22':
    'A user agent ignores a cookie with an empty name whose value begins with `__Secure-` or `__Host-`, matched case-insensitively.',
  '6.1/1': 'Servers SHOULD use as few and as small cookies as possible.',
  '6.1/2':
    'Servers SHOULD gracefully degrade if the user agent fails to return one or more cookies in the Cookie header field.',
  '7.4/1':
    'Servers SHOULD promote user privacy by selecting reasonable cookie expiration periods based on the purpose of the cookie.',
  '8.3/1':
    'Servers SHOULD encrypt and sign the contents of cookies when transmitting them to the user agent.',
  '8.3/2':
    'Servers that require a higher level of security SHOULD use the Cookie and Set-Cookie header fields only over a secure channel, and when using cookies over a secure channel SHOULD set the Secure attribute for every cookie.',
  '8.4/1':
    'The server SHOULD take care to avoid session fixation vulnerabilities.',
  '8.5/1':
    'Servers SHOULD NOT both run mutually distrusting services on different ports of the same host and use cookies to store security-sensitive information.',
  '8.6/1':
    'Servers SHOULD NOT both run mutually distrusting services on different paths of the same host and use cookies to store security-sensitive information.',
  '8.6/2': 'Servers SHOULD NOT rely upon user agents retaining cookies.',
} as const;

export default defineCoverage({
  source: {
    revision: 'draft-ietf-httpbis-rfc6265bis-22 (December 2025)',
    countingRule:
      'One unit per paragraph of draft-22 that contains a BCP 14 keyword and binds a cookie-producing implementation (§3.2.1), wherever it stands, plus one unit per step of the user-agent algorithms in §5.5–§5.7 at which the user agent ignores, drops or caps a cookie, or one of its attributes, that it received in a Set-Cookie header field.',
    hasKeywordBasis: true,
  },
  units,
  rules: {
    // `syntax` — §1, §3 and §4.1.1, and every step whose trigger is a line
    // the grammar rejects.
    // One defect, one violation: every line that triggers one of these units
    // is a line §4.1.1's grammar rejects — an empty name fails `token`, a
    // control character, a non-ASCII octet or unencoded data fails
    // `cookie-octet` or `av-octet`, an Expires that is no cookie-date is no
    // IMF-fixdate either, and an empty or non-digit Max-Age fails
    // `non-zero-digit *DIGIT`. The grammar rule owns parse failures, so each
    // is reported once, with what the browser does in the message.
    'rfc-6265bis/server-must-send-set-cookie-conforming-to-grammar': {
      covers: [
        '1/1',
        '4.1.1/1',
        '4.1.1/2',
        '4.1.1/3',
        '4.1.1/8',
        '5.6/step-1',
        '5.6.1/step-2',
        '5.6.2/step-1',
        '5.6.2/step-2',
        '5.6.2/step-3',
        '5.7/step-2',
        '5.7/step-3',
        '5.7/step-8',
        '5.7/step-22',
      ],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
    },
    // A MAY is checkable at `hint`: the finding is that the mechanism goes
    // unused, not that the server is non-conformant.
    'rfc-6265bis/origin-server-may-send-set-cookie-with-any-response': {
      covers: ['3/1'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'hint' },
    },
    // A comma followed by what reads as a second cookie-pair is the only
    // trace of combining, and a comma inside an attribute value reads the
    // same (the draft's own `a=b;path=/c,d=e`): heuristic everywhere, and
    // lower than the MUST NOT's `error`.
    'rfc-6265bis/origin-server-must-not-combine-set-cookie-fields': {
      covers: ['3/2'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'warn' },
      contexts: {
        static: 'heuristic',
        test: 'heuristic',
        analytics: 'heuristic',
      },
    },
    'rfc-6265bis/server-must-process-cookie-octets-as-us-ascii': {
      covers: ['3/3'],
      declared: { types: ['informational'], severity: 'error' },
    },
    'rfc-6265bis/server-may-wrap-cookie-value-in-double-quotes': {
      covers: ['4.1.1/4'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'hint' },
    },
    'rfc-6265bis/server-must-not-send-whitespace-around-extension-attributes': {
      covers: ['4.1.1/5'],
      declared: {
        types: ['static', 'test', 'analytics'],
        severity: 'error',
      },
    },
    'rfc-6265bis/server-must-not-repeat-cookie-attributes': {
      covers: ['4.1.1/6'],
      declared: { types: ['static', 'test', 'analytics'], severity: 'error' },
    },
    'rfc-6265bis/server-must-send-only-one-set-cookie-per-cookie-name': {
      covers: ['4.1.1/7'],
      declared: { types: ['test', 'analytics'], severity: 'error' },
      contexts: {
        static: {
          verdict: 'impossible',
          reason: 'not-representable',
          note: 'An API description declares response headers as a map keyed by name, so it cannot declare two Set-Cookie field lines in one response.',
        },
      },
    },
  },
});
