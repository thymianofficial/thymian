import { describe, expect, it } from 'vitest';

import { onResponses } from '../test/set-cookie.js';
import encryptAndSignContents from './considerations/server-should-encrypt-and-sign-cookie-contents.rule.js';
import selectReasonableExpiration from './considerations/server-should-select-reasonable-cookie-expiration.rule.js';
import setHttpOnly from './considerations/server-should-set-http-only-on-every-cookie.rule.js';
import useNamePrefixes from './prefixes/server-should-use-cookie-name-prefixes.rule.js';
import hostPrefixUnlessHostLocked from './prefixes/user-agent-must-ignore-host-prefixed-cookie-unless-host-locked.rule.js';
import securePrefixWithoutSecure from './prefixes/user-agent-must-ignore-secure-prefixed-cookie-without-secure.rule.js';
import capLifetime from './set-cookie-processing/user-agent-must-cap-cookie-lifetime-at-400-days.rule.js';
import attributeValueOver1024 from './set-cookie-processing/user-agent-must-ignore-attribute-value-over-1024-octets.rule.js';
import cookieOver4096 from './set-cookie-processing/user-agent-must-ignore-cookie-over-4096-octets.rule.js';
import unrecognizedAttributes from './set-cookie-processing/user-agent-must-ignore-unrecognized-cookie-attributes.rule.js';
import pathNotStartingWithSlash from './set-cookie-processing/user-agent-must-replace-path-not-starting-with-slash.rule.js';
import sameSiteNoneWithoutSecure from './storage-model/user-agent-must-ignore-same-site-none-cookie-without-secure.rule.js';
import notCombineFields from './syntax/origin-server-must-not-combine-set-cookie-fields.rule.js';
import mayWrapValueInQuotes from './syntax/server-may-wrap-cookie-value-in-double-quotes.rule.js';
import notRepeatAttributes from './syntax/server-must-not-repeat-cookie-attributes.rule.js';
import noWhitespaceAroundExtensions from './syntax/server-must-not-send-whitespace-around-extension-attributes.rule.js';
import conformToGrammar from './syntax/server-must-send-set-cookie-conforming-to-grammar.rule.js';

// Every rule here holds the Set-Cookie lines of a response to one
// requirement, so one shape tests them all: responses the rule flags, with
// what it says about each, and responses it accepts, in every context the
// rule declares. A response is the Set-Cookie lines it carries; most carry
// one.
const valueRules = [
  {
    rule: encryptAndSignContents,
    severity: 'warn',
    // `{"user":"alice","role":"admin"}`, percent-encoded, as a cookie-value
    // must carry JSON.
    violates: [
      {
        lines: [
          'profile=%7B%22user%22%3A%22alice%22%2C%22role%22%3A%22admin%22%7D',
        ],
        message: 'The value of the cookie "profile" is legible',
      },
    ],
    // An opaque identifier, Base64 with its padding, a signed `s:` token,
    // signed Base64 payloads joined to their signature by "--" or "." after
    // the padding, and a language tag.
    conforms: [
      ['SID=31d4d96e407aad42'],
      ['token=c2lnbmVkIGFuZCBlbmNyeXB0ZWQ='],
      ['connect.sid=s:5YhnTzWKvQ.Xq0Bo2m6Y8N5Hrj1Yf3h'],
      ['_app_session=eyJ1c2VyIjoiYWxpY2UifQ%3D--3f2a9c0d1e'],
      ['_rails_session=BAh7BkkiD3Nlc3Npb25faWQGOgZFVEkiJTk%3D--a1b2c3'],
      ['signed=Zm9v=.sig'],
      ['lang=en-US'],
    ],
  },
  {
    rule: selectReasonableExpiration,
    severity: 'warn',
    // Two weeks are 1209600 seconds; this session identifier asks for 30
    // days.
    violates: [
      {
        lines: ['__Host-SID=31d4d96e407aad42; Secure; Path=/; Max-Age=2592000'],
        message: 'asks, in its Max-Age attribute, for a lifetime of 30 days',
      },
    ],
    // Exactly two weeks, and a cookie whose name says nothing of its
    // purpose, whatever its lifetime.
    conforms: [
      ['__Host-SID=31d4d96e407aad42; Secure; Path=/; Max-Age=1209600'],
      ['lang=en-US; Max-Age=31536000'],
    ],
  },
  {
    rule: setHttpOnly,
    // A convention rule: it ships `off`.
    severity: 'off',
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Secure'],
        message: 'The cookie "SID" has no HttpOnly attribute',
      },
    ],
    // The second line clears a cookie, which a browser keeps no cookie from.
    conforms: [
      ['SID=31d4d96e407aad42; Secure; HttpOnly'],
      ['lang=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'],
    ],
  },
  {
    rule: useNamePrefixes,
    severity: 'warn',
    // A Secure, host-only cookie on Path=/ meets every requirement of
    // __Host- and carries no prefix.
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Secure; Path=/'],
        message: 'meets the requirements of the __Host- prefix',
      },
    ],
    // A cookie that carries one, and a cookie without Secure, which meets
    // neither prefix's requirements.
    conforms: [['__Host-SID=31d4d96e407aad42; Secure; Path=/'], ['lang=en-US']],
  },
  {
    rule: hostPrefixUnlessHostLocked,
    severity: 'error',
    // The prefix is matched case-insensitively, so __HOST- is the prefix all
    // the same; its Domain keeps the cookie from being host-only.
    violates: [
      {
        lines: [
          '__HOST-SID=31d4d96e407aad42; Secure; Path=/; Domain=example.com',
        ],
        message: 'it has a Domain attribute (Domain=example.com)',
      },
    ],
    conforms: [['__Host-SID=31d4d96e407aad42; Secure; Path=/']],
  },
  {
    rule: securePrefixWithoutSecure,
    severity: 'error',
    // The prefix is matched case-insensitively, so a lowercase __secure- is
    // the prefix all the same.
    violates: [
      {
        lines: ['__secure-SID=31d4d96e407aad42; Path=/'],
        message: 'its name starts with the __Secure- prefix',
      },
    ],
    conforms: [['__Secure-SID=31d4d96e407aad42; Path=/; Secure']],
  },
  {
    rule: capLifetime,
    severity: 'warn',
    // 400 days are 34560000 seconds.
    violates: [
      {
        lines: ['lang=en-US; Path=/; Max-Age=34560001'],
        message: 'for a lifetime of 34560001 seconds (401 days)',
      },
    ],
    // Exactly 400 days in Max-Age, which wins over its Expires: the Expires
    // in 2200 has no effect, so nothing is capped.
    conforms: [
      [
        'lang=en-US; Path=/; Max-Age=34560000; Expires=Wed, 01 Jan 2200 00:00:00 GMT',
      ],
    ],
  },
  {
    rule: attributeValueOver1024,
    severity: 'error',
    // A Path of 1025 octets is one past the limit; the conforming one is
    // exactly at it. A Path is any run of av-octets, so both conform to the
    // grammar.
    violates: [
      {
        lines: [`SID=31d4d96e407aad42; Path=/${'a'.repeat(1024)}; Secure`],
        message: 'Path, as the attribute value is 1025 octets, more than 1024',
      },
    ],
    conforms: [[`SID=31d4d96e407aad42; Path=/${'a'.repeat(1023)}; Secure`]],
  },
  {
    rule: cookieOver4096,
    severity: 'error',
    // A name of 3 octets and a value of 4094 are 4097 together, one past the
    // limit; the conforming line is exactly at it. Both conform to the
    // grammar, which sets no length limit.
    violates: [
      {
        lines: [`SID=${'x'.repeat(4094)}; Path=/; Secure`],
        message: "the cookie's name and value are 4097 octets together",
      },
    ],
    conforms: [[`SID=${'x'.repeat(4093)}; Path=/; Secure`]],
  },
  {
    rule: unrecognizedAttributes,
    severity: 'hint',
    // Priority is an extension-av no draft-22 user agent recognizes.
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Path=/; Secure; Priority=High'],
        message: 'carries the attribute "Priority"',
      },
    ],
    // Defined attributes spelled in other cases, which a user agent still
    // recognizes.
    conforms: [
      ['SID=31d4d96e407aad42; path=/; secure; HTTPONLY; SameSite=Lax'],
    ],
  },
  {
    rule: pathNotStartingWithSlash,
    severity: 'error',
    // A Path is any run of av-octets, so a relative or empty one conforms to
    // the grammar; a user agent then scopes the cookie to the default-path
    // instead. Only the last Path counts, since the cookie keeps it.
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Path=docs; Secure'],
        message: 'carries "Path=docs", which does not start with "/"',
      },
      {
        lines: ['SID=31d4d96e407aad42; Path=; Secure'],
        message: 'carries "Path=", which does not start with "/"',
      },
      {
        lines: ['SID=31d4d96e407aad42; Path=/docs; Path=docs; Secure'],
        message: 'carries "Path=docs", which does not start with "/"',
      },
    ],
    // A Path past 1024 octets is ignored before it is read, which the
    // 1024-octet rule reports, so this rule stays silent on it.
    conforms: [
      ['SID=31d4d96e407aad42; Path=/docs; Secure'],
      [`SID=31d4d96e407aad42; Path=${'a'.repeat(1025)}; Secure`],
      ['SID=31d4d96e407aad42; Path=docs; Path=/docs; Secure'],
    ],
  },
  {
    rule: sameSiteNoneWithoutSecure,
    severity: 'error',
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; SameSite=None'],
        message: 'it asks for SameSite=None without the Secure attribute',
      },
    ],
    // SameSite=None needs Secure; any other SameSite does not.
    conforms: [
      ['SID=31d4d96e407aad42; SameSite=None; Secure'],
      ['lang=en-US; SameSite=Lax'],
    ],
  },
  {
    rule: notCombineFields,
    severity: 'warn',
    // Two cookies joined with ", " after the first one's last attribute: a
    // Path, which the grammar accepts with the comma, and a SameSite, whose
    // value the comma breaks.
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Path=/, lang=en-US; Path=/'],
        message: 'carries a comma followed by "lang="',
      },
      {
        lines: ['SID=31d4d96e407aad42; SameSite=Lax, lang=en-US; Path=/'],
        message: 'carries a comma followed by "lang="',
      },
    ],
    // The same two cookies on one response, each in a field of its own, the
    // first with an Expires date, whose comma is no second cookie.
    conforms: [
      [
        'SID=31d4d96e407aad42; Path=/; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
        'lang=en-US; Path=/',
      ],
    ],
  },
  {
    rule: mayWrapValueInQuotes,
    severity: 'hint',
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Path=/; Secure'],
        message: 'is not wrapped in DQUOTE characters',
      },
    ],
    conforms: [['SID="31d4d96e407aad42"; Path=/; Secure']],
  },
  {
    rule: notRepeatAttributes,
    severity: 'error',
    // Path repeated in another case, which is the same attribute.
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Path=/; Secure; path=/account'],
        message: 'carries the attribute Path 2 times',
      },
    ],
    // The same attributes on two cookies of one response: repetition counts
    // within one line, not across a response.
    conforms: [
      ['SID=31d4d96e407aad42; Path=/; Secure', 'lang=en-US; Path=/; Secure'],
    ],
  },
  {
    rule: noWhitespaceAroundExtensions,
    severity: 'error',
    violates: [
      {
        lines: ['SID=31d4d96e407aad42; Priority=High ; Secure'],
        message: 'has whitespace after the extension attribute "Priority=High"',
      },
    ],
    // The "; " every attribute is conventionally separated by, which the
    // grammar reads as OWS before the attribute.
    conforms: [['SID=31d4d96e407aad42; Priority=High; Secure']],
  },
  {
    rule: conformToGrammar,
    severity: 'error',
    // Two lines on one response, each judged on its own: only the second
    // deviates, with an Expires that is no IMF-fixdate.
    violates: [
      {
        lines: [
          'SID=31d4d96e407aad42; Path=/; Secure; HttpOnly',
          'lang=en-US; Expires=Wed, 09-Jun-2021 10:18:14 GMT',
        ],
        message:
          'The Set-Cookie line "lang=en-US; Expires=Wed, 09-Jun-2021 10:18:14 GMT" deviates',
      },
    ],
    // The Expires date carries a comma, which a reader that split Set-Cookie
    // on commas would break.
    conforms: [
      [
        'SID=31d4d96e407aad42; Path=/; Secure; HttpOnly',
        'lang=en-US; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
      ],
    ],
  },
] as const;

describe.each(valueRules)(
  '$rule.meta.name',
  ({ rule, severity, violates, conforms }) => {
    // One transaction per response of the table, the flagged ones first.
    const answers = [
      ...violates.map(({ lines }) => ({ lines: [...lines] })),
      ...conforms.map((lines) => ({ lines: [...lines] })),
    ];
    const expected = (transactions: string[]) => [
      ...violates.map(({ message }, index) => ({
        location: { elementId: transactions[index] },
        status: 'failed',
        severity,
        message: expect.stringContaining(message),
      })),
      ...conforms.map((_lines, index) => ({
        location: { elementId: transactions[violates.length + index] },
        status: 'passed',
      })),
    ];

    it('judges, in static, the lines the API description pins', async () => {
      const { executions, transactions } = await onResponses(rule, 'static', [
        ...answers,
        // Declared without a value: nothing to judge, which is a skip and
        // not a pass.
        { lines: [] },
        {},
      ]);
      const [unpinned, withoutSetCookie] = transactions.slice(-2);

      expect(executions).toMatchObject([
        ...expected(transactions),
        {
          location: { elementId: unpinned },
          status: 'skipped',
          reason: expect.stringContaining('without pinning its value'),
        },
        { location: { elementId: withoutSetCookie }, status: 'notApplicable' },
      ]);
    });

    // The API description declares no Set-Cookie at all: a server sending
    // one anyway is what a rule that only looked at declared headers would
    // miss.
    it.each([
      ['test', 'the server sends although none is declared'],
      ['analytics', 'that were recorded'],
    ] as const)('judges, in %s, the lines %s', async (context, _what) => {
      const { executions, transactions } = await onResponses(rule, context, [
        ...answers,
        {},
      ]);

      expect(executions).toMatchObject([
        ...expected(transactions),
        { location: { elementId: transactions.at(-1) }, status: 'passed' },
      ]);
    });
  },
);
