import { describe, expect, it } from 'vitest';

import { getContentType, getHeader } from '../src/utils.js';

// Characterization tests for `getHeader`'s behavior -- see
// spec-643-4-reimplement-getheader-on-the-http-fields-engine. These pin down
// every non-duplicate-key input so the reimplementation is proven
// byte-for-byte identical to the legacy implementation for those cases. The
// case-variant duplicate-key test is the one sanctioned exception: it
// originally asserted today's buggy first-match-only output and has since
// been flipped to the fixed (merged) output below.
describe('getHeader', () => {
  it('returns the value for a single case-insensitive key match (string value)', () => {
    const headers = { 'Content-Type': 'text/html' };

    expect(getHeader(headers, 'content-type')).toBe('text/html');
  });

  it('matches the header name case-insensitively regardless of which side varies', () => {
    const headers = { 'X-Custom-Header': 'value' };

    expect(getHeader(headers, 'x-custom-header')).toBe('value');
  });

  it('returns a single-element array match unchanged, without unwrapping it to a string', () => {
    const headers = { 'X-Foo': ['only'] };

    expect(getHeader(headers, 'x-foo')).toEqual(['only']);
  });

  it('returns a multi-element array match unchanged', () => {
    const headers = { 'Set-Cookie': ['a=1', 'b=2'] };

    expect(getHeader(headers, 'set-cookie')).toEqual(['a=1', 'b=2']);
  });

  it('returns undefined when the header is absent', () => {
    expect(getHeader({}, 'x-missing')).toBeUndefined();
  });

  it('merges case-variant duplicate keys into one array, in encounter order (the fix)', () => {
    const headers = { 'Set-Cookie': 'a=1', 'set-cookie': 'b=2' };

    expect(getHeader(headers, 'Set-Cookie')).toEqual(['a=1', 'b=2']);
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
});
