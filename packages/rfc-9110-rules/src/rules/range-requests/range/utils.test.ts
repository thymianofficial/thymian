import { describe, expect, it } from 'vitest';

import { parseRangeHeader } from './utils';

describe('parseRangeHeader', () => {
  it('parses a valid single range', () => {
    const result = parseRangeHeader('bytes=0-499');

    expect(result).toEqual([{ start: 0, end: 499 }]);
  });

  it('parses valid multiple ranges', () => {
    const result = parseRangeHeader('bytes=0-499, 500-999, 1000-1499');

    expect(result).toEqual([
      { start: 0, end: 499 },
      { start: 500, end: 999 },
      { start: 1000, end: 1499 },
    ]);
  });

  it('parses array of headers', () => {
    const result = parseRangeHeader(['bytes=0-99', 'bytes=100-199']);

    expect(result).toEqual([
      { start: 0, end: 99 },
      { start: 100, end: 199 },
    ]);
  });

  it('returns empty array for invalid format without bytes prefix', () => {
    const result = parseRangeHeader('0-499');

    expect(result).toEqual([]);
  });

  it('throws error for invalid range with missing end value', () => {
    expect(() => parseRangeHeader('bytes=0-')).toThrow('Invalid range');
  });
});
