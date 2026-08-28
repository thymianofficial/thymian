import { describe, expect, it } from 'vitest';

import type { HttpResponse } from '../src/http.js';
import {
  getContentType,
  getHeader,
  httpResponseToLabel,
  objHasKeyIgnoreCase,
} from '../src/utils.js';

// Characterization tests for `getHeader`'s behavior. These pin down every
// non-duplicate-key input so the reimplementation (which delegates its
// case-variant duplicate-key merge to the `http-fields` engine) is proven
// byte-for-byte identical to the legacy implementation for those cases. The
// case-variant duplicate-key test is the one sanctioned exception: it
// originally asserted the old buggy first-match-only output and has since
// been flipped to the fixed (merged) output below. The remaining tests cover
// the counting fix: "how many matches" must count keys holding a *defined*
// value, not raw key existence, so an all-undefined duplicate resolves to
// `undefined` (never a truthy empty array) and a duplicate with exactly one
// defined value resolves to that plain value (never a 1-element array).
describe('getHeader', () => {
  it('returns the value for a single case-insensitive key match (string value)', () => {
    const headers = { 'Content-Type': 'text/html' };

    expect(getHeader(headers, 'content-type')).toBe('text/html');
  });

  it('matches the header name case-insensitively regardless of which side varies', () => {
    const headers = { 'X-Custom-Header': 'value' };

    expect(getHeader(headers, 'x-custom-header')).toBe('value');
  });

  it('returns a single-element array match by the same reference, without unwrapping it to a string', () => {
    const value = ['only'];
    const headers = { 'X-Foo': value };

    // Reference identity, not just deep equality: callers untangle
    // `string | string[]` in place, and a fresh array would be an observable
    // change for anything comparing or mutating what it got back.
    expect(getHeader(headers, 'x-foo')).toBe(value);
  });

  it('returns a multi-element array match by the same reference', () => {
    const value = ['a=1', 'b=2'];
    const headers = { 'Set-Cookie': value };

    expect(getHeader(headers, 'set-cookie')).toBe(value);
  });

  it('returns an empty-array match by the same reference, not undefined', () => {
    const value: string[] = [];
    const headers = { 'X-Foo': value };

    expect(getHeader(headers, 'x-foo')).toBe(value);
  });

  it('falls back to the empty-record default when the headers argument is omitted', () => {
    expect(getHeader(undefined, 'x-missing')).toBeUndefined();
  });

  it('returns undefined when the header is absent', () => {
    expect(getHeader({}, 'x-missing')).toBeUndefined();
  });

  it('merges case-variant duplicate keys into one array, in encounter order (the fix)', () => {
    const headers = { 'Set-Cookie': 'a=1', 'set-cookie': 'b=2' };

    expect(getHeader(headers, 'Set-Cookie')).toEqual(['a=1', 'b=2']);
  });

  it('returns undefined when both case-variant duplicate keys are present but undefined', () => {
    const headers = { 'X-Foo': undefined, 'x-foo': undefined };

    expect(getHeader(headers, 'X-Foo')).toBeUndefined();
  });

  it('returns the plain value when one case-variant duplicate key is undefined and the other holds a real value', () => {
    const headers = { 'Content-Type': undefined, 'content-type': 'text/html' };

    expect(getHeader(headers, 'content-type')).toBe('text/html');
  });

  it('flattens a case-variant duplicate merge when one of the values is itself an array', () => {
    const headers = { 'Set-Cookie': ['a=1'], 'set-cookie': 'b=2' };

    expect(getHeader(headers, 'Set-Cookie')).toEqual(['a=1', 'b=2']);
  });

  it('returns the plain value when one case-variant duplicate key holds an empty array and the other a real value', () => {
    const headers = { 'Set-Cookie': [] as string[], 'set-cookie': 'b=2' };

    expect(getHeader(headers, 'Set-Cookie')).toBe('b=2');
  });

  it('returns undefined when both case-variant duplicate keys hold an empty array', () => {
    const headers = {
      'Set-Cookie': [] as string[],
      'set-cookie': [] as string[],
    };

    expect(getHeader(headers, 'Set-Cookie')).toBeUndefined();
  });

  it('returns the array unchanged when the sole contributing duplicate key holds an array value', () => {
    const headers = { 'Set-Cookie': undefined, 'set-cookie': ['a=1', 'b=2'] };

    expect(getHeader(headers, 'Set-Cookie')).toEqual(['a=1', 'b=2']);
  });

  it('returns undefined for a single present key whose own value is undefined (not the same as the header being absent entirely)', () => {
    const headers = { 'X-Foo': undefined };

    expect(getHeader(headers, 'x-foo')).toBeUndefined();
  });
});

// Characterization tests for `objHasKeyIgnoreCase`, which is now
// `@deprecated` in favor of `fromRuntimeHeaders(...).has(...)`. Its behavior
// is unchanged; these pin it so the deprecation stays annotation-only.
describe('objHasKeyIgnoreCase', () => {
  it('finds a key case-insensitively', () => {
    expect(
      objHasKeyIgnoreCase({ 'Content-Type': 'text/html' }, 'content-type'),
    ).toBe(true);
  });

  it('returns false for an absent key', () => {
    expect(objHasKeyIgnoreCase({}, 'content-type')).toBe(false);
  });

  it('returns true for a declared key whose value is undefined', () => {
    // The behavioral difference from fromRuntimeHeaders(...).has(), and the
    // reason the deprecation notice calls it out: presence here means the key
    // exists, not that a value does.
    expect(objHasKeyIgnoreCase({ 'X-Foo': undefined }, 'x-foo')).toBe(true);
  });
});

describe('getContentType', () => {
  it('throws when case-variant duplicate content-type headers are present, now that getHeader merges them', () => {
    const headers = {
      'Content-Type': 'text/html',
      'content-type': 'text/plain',
    };

    expect(() => getContentType(headers)).toThrow(
      'Multiple content-type headers found.',
    );
  });

  it('does not throw when one case-variant duplicate content-type key holds an empty array and the other a real value', () => {
    const headers = {
      'Content-Type': [] as string[],
      'content-type': 'text/html',
    };

    expect(getContentType(headers)).toBe('text/html');
  });
});

describe('httpResponseToLabel', () => {
  it('derives the media type from the first value of a genuine duplicate content-type header', () => {
    const response: HttpResponse = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'content-type': 'text/plain',
      },
      trailers: {},
      duration: 0,
    };

    expect(httpResponseToLabel(response)).toBe('200 ok text/html');
  });
});
