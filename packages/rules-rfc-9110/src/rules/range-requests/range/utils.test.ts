import { describe, expect, it } from 'vitest';

import { formatByteRange, parseRangeHeader } from './utils';

describe('parseRangeHeader', () => {
  it('parses a valid single range', () => {
    const result = parseRangeHeader('bytes=0-499');

    expect(result).toEqual([{ kind: 'int', first: 0, last: 499 }]);
  });

  it('parses valid multiple ranges', () => {
    const result = parseRangeHeader('bytes=0-499, 500-999, 1000-1499');

    expect(result).toEqual([
      { kind: 'int', first: 0, last: 499 },
      { kind: 'int', first: 500, last: 999 },
      { kind: 'int', first: 1000, last: 1499 },
    ]);
  });

  it('parses a header given as a single field line', () => {
    const result = parseRangeHeader(['bytes=0-99']);

    expect(result).toEqual([{ kind: 'int', first: 0, last: 99 }]);
  });

  it('parses an open-ended range without inventing its last position', () => {
    const result = parseRangeHeader('bytes=0-');

    expect(result).toEqual([{ kind: 'int', first: 0 }]);
  });

  it('parses a suffix range as a length, not as a first position', () => {
    const result = parseRangeHeader('bytes=-500');

    expect(result).toEqual([{ kind: 'suffix', length: 500 }]);
  });

  it('parses all three forms in one range set', () => {
    const result = parseRangeHeader('bytes=0-99, 200-, -50');

    expect(result).toEqual([
      { kind: 'int', first: 0, last: 99 },
      { kind: 'int', first: 200 },
      { kind: 'suffix', length: 50 },
    ]);
  });

  it('reads the range unit case-insensitively', () => {
    const result = parseRangeHeader('Bytes=0-99');

    expect(result).toEqual([{ kind: 'int', first: 0, last: 99 }]);
  });

  it('ignores empty list elements', () => {
    const result = parseRangeHeader('bytes=0-99, , 200-299,');

    expect(result).toEqual([
      { kind: 'int', first: 0, last: 99 },
      { kind: 'int', first: 200, last: 299 },
    ]);
  });

  it.each([
    ['without a range unit', '0-499'],
    ['with another range unit', 'items=0-4'],
    ['with an empty range set', 'bytes='],
    ['with a spec missing both positions', 'bytes=-'],
    ['with a non-numeric position', 'bytes=abc-def'],
    ['with a last position before its first', 'bytes=500-499'],
    ['with one invalid spec among valid ones', 'bytes=0-99, x, 200-299'],
    ['with an empty value', ''],
    ['with several field lines', ['bytes=0-99', 'bytes=100-199']],
  ])('returns undefined for a header %s', (_, header) => {
    expect(parseRangeHeader(header)).toBeUndefined();
  });
});

describe('formatByteRange', () => {
  it.each([
    [{ kind: 'int', first: 0, last: 499 } as const, '0-499'],
    [{ kind: 'int', first: 500 } as const, '500-'],
    [{ kind: 'suffix', length: 500 } as const, '-500'],
  ])('writes %o as %s', (range, expected) => {
    expect(formatByteRange(range)).toBe(expected);
  });
});
