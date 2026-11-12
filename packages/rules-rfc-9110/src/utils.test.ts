import { describe, expect, it } from 'vitest';

import { headerToString } from './utils.js';

describe('headerToString', () => {
  it('returns undefined for an absent header', () => {
    expect(headerToString(undefined)).toBeUndefined();
  });

  it('returns a single value unchanged', () => {
    expect(headerToString('gzip, br')).toBe('gzip, br');
  });

  it('joins multiple values with a bare comma by default', () => {
    expect(headerToString(['gzip', 'br'])).toBe('gzip,br');
  });

  it('joins multiple values with the given separator', () => {
    expect(headerToString(['a=1', 'b=2'], ', ')).toBe('a=1, b=2');
  });

  it('returns an empty string for an empty list', () => {
    expect(headerToString([])).toBe('');
  });
});
