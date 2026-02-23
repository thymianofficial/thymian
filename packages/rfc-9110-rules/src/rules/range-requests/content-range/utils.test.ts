import { describe, expect, it } from 'vitest';

import { parseContentRange } from './utils';

describe('parseContentRange', () => {
  it('parses valid range with known size', () => {
    const result = parseContentRange('bytes 0-499/1000');

    expect(result).toEqual([{ unit: 'bytes', start: 0, end: 499, size: 1000 }]);
  });

  it('parses valid range with unknown size', () => {
    const result = parseContentRange('bytes 500-999/*');

    expect(result).toEqual([
      { unit: 'bytes', start: 500, end: 999, size: null },
    ]);
  });

  it('parses array of headers', () => {
    const result = parseContentRange(['bytes 0-99/200', 'bytes 100-199/200']);

    expect(result).toEqual([
      { unit: 'bytes', start: 0, end: 99, size: 200 },
      { unit: 'bytes', start: 100, end: 199, size: 200 },
    ]);
  });

  it('returns empty array for invalid format without slash', () => {
    const result = parseContentRange('bytes 0-499');

    expect(result).toEqual([]);
  });
});
