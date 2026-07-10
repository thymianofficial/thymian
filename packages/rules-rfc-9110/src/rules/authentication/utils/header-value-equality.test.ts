import { describe, expect, it } from 'vitest';

import { equalHeaderValues } from './header-value-equality';

describe('equalHeaderValues', () => {
  it('treats identical strings as equal', () => {
    expect(equalHeaderValues('Basic realm="x"', 'Basic realm="x"')).toBe(true);
  });

  it('treats different strings as unequal', () => {
    expect(equalHeaderValues('Basic realm="x"', 'Basic realm="y"')).toBe(false);
  });

  it('treats a string and its one-element array representation as equal', () => {
    expect(equalHeaderValues('Basic realm="x"', ['Basic realm="x"'])).toBe(
      true,
    );
  });

  it('ignores the order of repeated field lines', () => {
    expect(
      equalHeaderValues(
        ['Basic realm="x"', 'Bearer realm="y"'],
        ['Bearer realm="y"', 'Basic realm="x"'],
      ),
    ).toBe(true);
  });

  it('detects a changed line among repeated field lines', () => {
    expect(
      equalHeaderValues(
        ['Basic realm="x"', 'Bearer realm="y"'],
        ['Basic realm="x"', 'Bearer realm="z"'],
      ),
    ).toBe(false);
  });

  it('detects an added or removed field line', () => {
    expect(
      equalHeaderValues(
        ['Basic realm="x"'],
        ['Basic realm="x"', 'Bearer realm="y"'],
      ),
    ).toBe(false);
    expect(equalHeaderValues('Basic realm="x"', undefined)).toBe(false);
  });

  it('treats absent values and empty arrays as equal', () => {
    expect(equalHeaderValues(undefined, undefined)).toBe(true);
    expect(equalHeaderValues([], undefined)).toBe(true);
  });

  it('does not mutate the input arrays when sorting', () => {
    const value = ['b', 'a'];
    equalHeaderValues(value, ['a', 'b']);
    expect(value).toEqual(['b', 'a']);
  });
});
