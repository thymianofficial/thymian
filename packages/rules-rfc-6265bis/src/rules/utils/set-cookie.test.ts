import { describe, expect, it } from 'vitest';

import {
  type CookieAttribute,
  hasCookiePrefix,
  ignoredOnReceipt,
  readAsProducer,
  readAsUserAgent,
} from './set-cookie.js';

// The parser's contract is draft-22 itself: §4.1.1's grammar for the
// producer reading, §5.6's algorithm for the user-agent reading. Every
// expectation below is read off the draft, not off the parser.

const NAME_4000 = 'n'.repeat(4000);
const VALUE_96 = 'v'.repeat(96);

describe('the producer reading, against the §4.1.1 grammar', () => {
  it.each([
    'SID=31d4d96e407aad42',
    'SID=31d4d96e407aad42; Path=/; Secure; HttpOnly',
    // §3.1's own examples.
    'lang=en-US; Path=/; Domain=site.example',
    'lang=en-US; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
    'lang=; Expires=Sun, 06 Nov 1994 08:49:37 GMT',
    // An empty cookie-value is `*cookie-octet`.
    'SID=',
    // The value MAY be wrapped in DQUOTE.
    'SID="31d4d96e407aad42"',
    'SID=""',
    // "=" is a cookie-octet.
    'SID=a=b',
    // BWS around "=" and before ";", OWS after it.
    ' SID = 31d4 ;Path = / ;  Secure',
    // Attribute names are case-insensitive, as are ABNF string literals.
    'SID=1; secure; HTTPONLY; max-age=60; samesite=lax; PATH=/',
    'SID=1; SameSite=None; Secure',
    'SID=1; SameSite=Strict',
    'SID=1; Max-Age=34560000',
    'SID=1; Domain=192.168.0.1',
    'SID=1; Domain=a-b.site.example',
    'SID=1; Path=',
    // An attribute the draft does not define is an extension-av.
    'SID=1; Partitioned',
    'SID=1; Priority=High; x y=z',
    // Several attributes of one name are a separate MUST, not the grammar's.
    'SID=1; Path=/; Path=/a',
    // No length limit is part of the grammar.
    `${NAME_4000}=${VALUE_96}x`,
    `SID=1; Path=/${'p'.repeat(1100)}`,
    // HTTP strips trailing whitespace from a field value (RFC 9110 §5.5).
    'SID=1; Secure ',
  ])('reads "%s" as conforming', (line) => {
    expect(readAsProducer(line).conforms).toBe(true);
  });

  it('gives the name, the value and the attributes of a conforming line', () => {
    expect(readAsProducer('SID="31d4"; Path=/; secure; Max-Age = 60')).toEqual({
      conforms: true,
      name: 'SID',
      // The DQUOTEs are part of the cookie-value.
      value: '"31d4"',
      attributes: [
        { name: 'Path', value: '/' },
        { name: 'secure' },
        { name: 'Max-Age', value: '60' },
      ],
    });
  });

  it.each([
    // The cookie-pair.
    ['SID', /"="/],
    ['=31d4', /empty/],
    [' =31d4', /empty/],
    ['S ID=1', /token/],
    ['S,ID=1', /token/],
    ['SÏD=1', /token/],
    ['SID=31 d4', /cookie-octet/],
    ['SID=31,d4', /cookie-octet/],
    ['SID=31\\d4', /cookie-octet/],
    ['SID=a"b', /cookie-octet/],
    ['SID="31d4', /no DQUOTE closes/],
    ['SID="', /no DQUOTE closes/],
    ['SID="31d4" x', /after the DQUOTE that closes it/],
    ['SID="31d4"x', /after the DQUOTE that closes it/],
    ['SID="31 d4"', /cookie-octet/],
    ['SID=café', /cookie-octet/],
    // Control characters, anywhere.
    ['SID=31\u0007d4', /cookie-octet/],
    ['SID=31d4; Path=/\u0000', /Path/],
    ['SID=31d4; Foo\u007f', /extension-av/],
    ['SID=31d4; Foo\tBar', /extension-av/],
    // An empty cookie-av is no extension-av.
    ['SID=31d4;', /empty/],
    ['SID=31d4; ; Secure', /empty/],
    // Expires.
    ['SID=1; Expires', /Expires/],
    ['SID=1; Expires=Wed, 09-Jun-2021 10:18:14 GMT', /IMF-fixdate/],
    ['SID=1; Expires=Wed, 09 Jun 21 10:18:14 GMT', /IMF-fixdate/],
    ['SID=1; Expires=wed, 09 Jun 2021 10:18:14 GMT', /IMF-fixdate/],
    ['SID=1; Expires=Wed, 09 Jun 2021 10:18:14 UTC', /IMF-fixdate/],
    ['SID=1; Expires=Wed, 31 Feb 2021 10:18:14 GMT', /cookie-date/],
    ['SID=1; Expires=Wed, 09 Jun 2021 24:00:00 GMT', /cookie-date/],
    // An IMF-fixdate that §5.1.1 cannot read: a year before 1601.
    ['SID=1; Expires=Wed, 09 Jun 1600 10:18:14 GMT', /cookie-date/],
    // Max-Age.
    ['SID=1; Max-Age', /Max-Age/],
    ['SID=1; Max-Age=', /Max-Age/],
    ['SID=1; Max-Age=0', /Max-Age/],
    ['SID=1; Max-Age=-1', /Max-Age/],
    ['SID=1; Max-Age=060', /Max-Age/],
    ['SID=1; Max-Age=1h', /Max-Age/],
    // Domain.
    ['SID=1; Domain', /Domain/],
    ['SID=1; Domain=', /Domain/],
    ['SID=1; Domain=.site.example', /Domain/],
    ['SID=1; Domain=site.example.', /Domain/],
    ['SID=1; Domain=-site.example', /Domain/],
    ['SID=1; Domain=sïte.example', /Domain/],
    [`SID=1; Domain=${'a'.repeat(64)}.example`, /Domain/],
    [`SID=1; Domain=${'a.'.repeat(128)}example`, /Domain/],
    // Path, Secure, HttpOnly, SameSite.
    ['SID=1; Path', /Path/],
    ['SID=1; Secure=true', /Secure/],
    ['SID=1; HttpOnly=1', /HttpOnly/],
    ['SID=1; SameSite', /SameSite/],
    ['SID=1; SameSite=Default', /SameSite/],
  ])('reads "%s" as deviating, naming the problem', (line, problem) => {
    const reading = readAsProducer(line);

    expect(reading.conforms).toBe(false);
    expect(reading.conforms ? undefined : reading.problem).toMatch(problem);
  });

  it('reports one problem for a line that deviates in several places', () => {
    const reading = readAsProducer('=a b; Max-Age=0; Domain=.x');

    expect(reading).toEqual({ conforms: false, problem: expect.any(String) });
    expect(reading.conforms ? undefined : reading.problem).toMatch(/empty/);
  });
});

describe('the user-agent reading, following §5.6', () => {
  it('records the name, the value and every attribute it recognizes', () => {
    expect(
      readAsUserAgent(
        ' SID = "31d4" ; path=/a ; DOMAIN=.Site.Example; Secure=yes; httponly; Max-Age=-5; SameSite=lax; Expires=Wed, 09 Jun 2021 10:18:14 GMT',
      ),
    ).toEqual({
      ignored: false,
      cookie: {
        name: 'SID',
        // Leading and trailing WSP is removed; DQUOTEs stay.
        value: '"31d4"',
        attributes: [
          { name: 'Path', value: '/a' },
          // A leading "." is dropped, and the domain lowercased.
          { name: 'Domain', value: 'site.example' },
          // Secure takes no value, so whatever follows "=" is not read.
          { name: 'Secure' },
          { name: 'HttpOnly' },
          { name: 'Max-Age', value: -5 },
          { name: 'SameSite', value: 'Lax' },
          { name: 'Expires', value: new Date('2021-06-09T10:18:14Z') },
        ],
      },
      ignoredAttributes: [],
    } satisfies ReturnType<typeof readAsUserAgent>);
  });

  it('reads an unknown SameSite as Default and a Path not starting with "/" as the default-path', () => {
    const reading = readAsUserAgent('SID=1; SameSite=Lox; Path=a; Path=');

    expect(reading.ignored ? [] : reading.cookie.attributes).toEqual([
      { name: 'SameSite', value: 'Default' },
      { name: 'Path', value: undefined },
      { name: 'Path', value: undefined },
    ] satisfies CookieAttribute[]);
  });

  it('keeps every repeated attribute, in order', () => {
    const reading = readAsUserAgent('SID=1; Path=/a; path=/b; Secure; Secure');

    expect(reading.ignored ? [] : reading.cookie.attributes).toEqual([
      { name: 'Path', value: '/a' },
      { name: 'Path', value: '/b' },
      { name: 'Secure' },
      { name: 'Secure' },
    ]);
  });

  it.each([
    // No "=": the name is empty and the whole pair is the value.
    ['SID', { name: '', value: 'SID' }],
    ['=31d4', { name: '', value: '31d4' }],
    ['SID=', { name: 'SID', value: '' }],
    ['=', { name: '', value: '' }],
    // Internal whitespace is kept; the grammar's other limits are not read.
    ['S ID=31 d4,x', { name: 'S ID', value: '31 d4,x' }],
    ['SID=a=b', { name: 'SID', value: 'a=b' }],
  ])('reads the name and value of "%s"', (line, cookie) => {
    const reading = readAsUserAgent(line);

    expect(reading.ignored ? undefined : reading.cookie).toEqual({
      ...cookie,
      attributes: [],
    });
  });

  it.each([
    ['SID=31\u0007d4', '5.6/step-1'],
    ['SID=31d4; Path=/\u0000', '5.6/step-1'],
    ['SID=31d4\u007f', '5.6/step-1'],
    ['SID=31d4\n', '5.6/step-1'],
    // The name and the value together, after trimming.
    [`${NAME_4000}=${VALUE_96}x`, '5.6/step-5'],
    // A name alone, and a value alone, past the limit.
    [`${'n'.repeat(4097)}=v`, '5.6/step-5'],
    [`${'n'.repeat(4097)}`, '5.6/step-5'],
    // Octets, not characters: "é" is one, "€" is three in UTF-8.
    [`SID=${'\u00e9'.repeat(4094)}`, '5.6/step-5'],
    [`SID=${'\u20ac'.repeat(1365)}`, '5.6/step-5'],
  ] as const)('ignores "%s" entirely, by %s', (line, step) => {
    expect(readAsUserAgent(line)).toEqual({
      ignored: true,
      step,
      reason: expect.stringMatching(/\S/),
    });
  });

  it('keeps a line with a horizontal tab, which is whitespace, not a control', () => {
    expect(readAsUserAgent('SID=31d4;\tSecure')).toMatchObject({
      ignored: false,
      cookie: { attributes: [{ name: 'Secure' }] },
    });
  });

  it('keeps a cookie whose name and value are exactly 4096 octets', () => {
    expect(readAsUserAgent(`${NAME_4000}=${VALUE_96}`).ignored).toBe(false);
  });

  // A live line arrives one octet per character, decoded as latin1, so a
  // character up to U+00FF is one octet wherever it came from.
  it('counts a character up to U+00FF as one octet', () => {
    const path = `/${'\u00e9'.repeat(1023)}`;

    expect(readAsUserAgent(`SID=${'\u00e9'.repeat(4093)}`).ignored).toBe(false);
    expect(readAsUserAgent(`SID=1; Path=${path}`)).toMatchObject({
      ignored: false,
      cookie: { attributes: [{ name: 'Path', value: path }] },
      ignoredAttributes: [],
    });
  });

  it.each([
    [`Path=/${'p'.repeat(1024)}`, '5.6/step-6'],
    [`Foo=${'f'.repeat(1025)}`, '5.6/step-6'],
    ['Partitioned', '5.6/step-7'],
    ['Priority=High', '5.6/step-7'],
    ['Expires=tomorrow', '5.6.1/step-2'],
    ['Expires=Wed, 31 Feb 2021 10:18:14 GMT', '5.6.1/step-2'],
    ['Expires=Wed, 09 Jun 1600 10:18:14 GMT', '5.6.1/step-2'],
    ['Max-Age=', '5.6.2/step-1'],
    ['Max-Age=+5', '5.6.2/step-2'],
    ['Max-Age=-', '5.6.2/step-2'],
    ['Max-Age=5s', '5.6.2/step-3'],
    ['Max-Age=-5-', '5.6.2/step-3'],
  ] as const)(
    'ignores the attribute "%s", by %s, and keeps the cookie',
    (cookieAv, step) => {
      expect(readAsUserAgent(`SID=1; ${cookieAv}; Secure`)).toEqual({
        ignored: false,
        cookie: { name: 'SID', value: '1', attributes: [{ name: 'Secure' }] },
        ignoredAttributes: [
          { cookieAv, step, reason: expect.stringMatching(/\S/) },
        ],
      });
    },
  );

  it('keeps an attribute value of exactly 1024 octets', () => {
    const path = `/${'p'.repeat(1023)}`;

    expect(readAsUserAgent(`SID=1; Path=${path}`)).toMatchObject({
      ignored: false,
      cookie: { attributes: [{ name: 'Path', value: path }] },
      ignoredAttributes: [],
    });
  });

  it.each([
    // §5.1.1 reads dates far more leniently than the grammar.
    ['Wed, 09-Jun-2021 10:18:14 GMT', '2021-06-09T10:18:14Z'],
    ['Wednesday, 09-Jun-21 10:18:14 GMT', '2021-06-09T10:18:14Z'],
    ['09 jun 1999 1:2:3', '1999-06-09T01:02:03Z'],
    ['Thu Jan 01 1970 00:00:00', '1970-01-01T00:00:00Z'],
  ])('reads the cookie-date "%s" as %s', (date, expected) => {
    expect(readAsUserAgent(`SID=1; Expires=${date}`)).toMatchObject({
      cookie: { attributes: [{ name: 'Expires', value: new Date(expected) }] },
    });
  });
});

describe('the cookies §5.7 ignores on receipt, from the line alone', () => {
  const received = (line: string) => {
    const reading = readAsUserAgent(line);
    return reading.ignored ? undefined : ignoredOnReceipt(reading.cookie);
  };

  it.each([
    ['=', '5.7/step-2'],
    ['SID=1; Domain=sïte.example', '5.7/step-8'],
    // The last Domain is the one that counts.
    ['SID=1; Domain=site.example; Domain=sïte.example', '5.7/step-8'],
    ['=__Secure-SID', '5.7/step-22'],
    ['__host-SID', '5.7/step-22'],
  ] as const)('ignores "%s", by %s', (line, step) => {
    expect(received(line)).toEqual({
      step,
      reason: expect.stringMatching(/\S/),
    });
  });

  it.each([
    'SID=',
    '=31d4',
    'SID=1; Domain=sïte.example; Domain=site.example',
    '__Host-SID=1; Secure; Path=/',
    'SID=__Host-1',
  ])('keeps "%s"', (line) => {
    expect(received(line)).toBeUndefined();
  });
});

describe('cookie name prefixes', () => {
  // §5.4: user agents match the prefix case-insensitively.
  it.each(['__Secure-SID', '__secure-SID', '__SECURE-SID', '__SeCuRe-SID'])(
    'finds __Secure- in "%s"',
    (name) => {
      expect(hasCookiePrefix(name, '__Secure-')).toBe(true);
      expect(hasCookiePrefix(name, '__Host-')).toBe(false);
    },
  );

  it.each(['__Host-SID', '__host-SID', '__HOST-SID'])(
    'finds __Host- in "%s"',
    (name) => {
      expect(hasCookiePrefix(name, '__Host-')).toBe(true);
    },
  );

  it.each(['SID', '_Secure-SID', '__Secure', 'x__Host-SID'])(
    'finds no prefix in "%s"',
    (name) => {
      expect(hasCookiePrefix(name, '__Secure-')).toBe(false);
      expect(hasCookiePrefix(name, '__Host-')).toBe(false);
    },
  );
});
