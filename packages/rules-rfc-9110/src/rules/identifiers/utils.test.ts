import { describe, expect, it } from 'vitest';

import { targetUriHasEmptyHost } from './utils';

describe('targetUriHasEmptyHost', () => {
  it('detects an empty authority', () => {
    expect(targetUriHasEmptyHost('http:///path')).toBe(true);
    expect(targetUriHasEmptyHost('https:///')).toBe(true);
    expect(targetUriHasEmptyHost('http://')).toBe(true);
    expect(targetUriHasEmptyHost('http://?query=1')).toBe(true);
  });

  it('detects an authority reduced to userinfo or port', () => {
    expect(targetUriHasEmptyHost('http://user:pass@/path')).toBe(true);
    expect(targetUriHasEmptyHost('http://@/path')).toBe(true);
    expect(targetUriHasEmptyHost('https://:8080/path')).toBe(true);
  });

  it('accepts targets with a host', () => {
    expect(targetUriHasEmptyHost('http://example.com/path')).toBe(false);
    expect(targetUriHasEmptyHost('https://example.com:8443/path')).toBe(false);
    expect(targetUriHasEmptyHost('http://user@example.com/path')).toBe(false);
    expect(targetUriHasEmptyHost('https://[::1]:8080/path')).toBe(false);
    expect(targetUriHasEmptyHost('HTTP://EXAMPLE.COM/path')).toBe(false);
  });

  it('ignores non-absolute-form targets', () => {
    expect(targetUriHasEmptyHost('/path?query=1')).toBe(false);
    expect(targetUriHasEmptyHost('example.com:443')).toBe(false);
    expect(targetUriHasEmptyHost('*')).toBe(false);
  });
});
