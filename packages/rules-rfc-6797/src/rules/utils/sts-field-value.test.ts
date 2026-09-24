import { describe, expect, it } from 'vitest';

import { parseStsFieldValue } from './sts-field-value.js';

// The one test below the engine seam: the parser is a pure function whose
// contract is RFC 6797 §6.1's ABNF, and these are the corners of it — RFC
// 2616's quoted-string and control characters, implied linear whitespace,
// empty directives — that a fixture cannot reach cheaply.
describe('parseStsFieldValue', () => {
  it.each([
    [
      'a single directive',
      'max-age=31536000',
      [{ name: 'max-age', value: '31536000' }],
    ],
    [
      'directive names lowercased, values kept as sent',
      'Max-Age=31536000; IncludeSubDomains; Foo=BaR',
      [
        { name: 'max-age', value: '31536000' },
        { name: 'includesubdomains' },
        { name: 'foo', value: 'BaR' },
      ],
    ],
    [
      'implied linear whitespace around every separator',
      ' \tmax-age = 1 ;\tincludeSubDomains ',
      [{ name: 'max-age', value: '1' }, { name: 'includesubdomains' }],
    ],
    [
      'a quoted-string value, unquoted',
      'max-age="31536000"',
      [{ name: 'max-age', value: '31536000' }],
    ],
    ['an empty quoted-string', 'foo=""', [{ name: 'foo', value: '' }]],
    [
      'a quoted-pair, unescaped',
      'max-age="31\\536000"',
      [{ name: 'max-age', value: '31536000' }],
    ],
    [
      'an escaped quote inside a quoted-string',
      'foo="a\\"b"',
      [{ name: 'foo', value: 'a"b' }],
    ],
    [
      'an escaped backslash inside a quoted-string',
      'foo="a\\\\b"',
      [{ name: 'foo', value: 'a\\b' }],
    ],
    [
      'separators inside a quoted-string',
      'foo="a;b=c, d"',
      [{ name: 'foo', value: 'a;b=c, d' }],
    ],
    [
      'a horizontal tab inside a quoted-string',
      'foo="a\tb"',
      [{ name: 'foo', value: 'a\tb' }],
    ],
    ['a trailing separator', 'max-age=1;', [{ name: 'max-age', value: '1' }]],
    [
      'empty directives between separators',
      ';; max-age=1 ;;',
      [{ name: 'max-age', value: '1' }],
    ],
    ['an empty value', '', []],
  ])('parses %s', (_case, fieldValue, directives) => {
    expect(parseStsFieldValue(fieldValue)).toEqual({
      conforms: true,
      directives,
    });
  });

  it.each([
    ['a comma where a semicolon belongs', 'max-age=1, includeSubDomains'],
    ['two directives without a separator', 'max-age=1 includeSubDomains'],
    ['a value missing after "="', 'max-age='],
    ['a directive without a name', '=31536000'],
    ['a separator inside a token value', 'max-age=1/2'],
    ['a control character in a directive name', 'max\u0001age=1'],
    ['a non-ASCII character in a token', 'max-âge=1'],
    ['an unterminated quoted-string', 'max-age="31536000'],
    ['a quoted-string ending in a lone backslash', 'foo="a\\'],
    ['a control character inside a quoted-string', 'foo="a\u0001b"'],
    ['a DEL inside a quoted-string', 'foo="a\u007fb"'],
    ['a line feed inside a quoted-string', 'foo="a\nb"'],
    ['a quoted-pair escaping a non-ASCII character', 'foo="a\\âb"'],
    ['a quoted-string with no "=" before it', 'max-age"1"'],
    ['text after a quoted-string', 'foo="a"b'],
  ])('reports one problem for %s', (_case, fieldValue) => {
    const parsed = parseStsFieldValue(fieldValue);

    expect(parsed).toEqual({ conforms: false, problem: expect.any(String) });
    expect(parsed.conforms === false && parsed.problem.length).toBeGreaterThan(
      0,
    );
  });
});
