import { describe, expect, it } from 'vitest';

import { Challenge, parseChallenges } from './auth-parser';

describe('parseChallenges', () => {
  it('parses a single challenge with a scheme and no parameters', () => {
    const headerValue = 'Basic';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([{ scheme: 'Basic', parameters: [] }]);
  });

  it('parses a challenge with a scheme and token68', () => {
    const headerValue = 'Bearer abc123';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([
      { scheme: 'Bearer', token68: 'abc123', parameters: [] },
    ]);
  });

  it('parses a challenge with a scheme and multiple parameters', () => {
    const headerValue =
      'Digest realm="example.com", qop="auth", nonce="abc123"';
    const result = parseChallenges(headerValue);

    expect(result).toEqual([
      {
        scheme: 'Digest',
        parameters: [
          { name: 'realm', value: 'example.com', isQuoted: true },
          { name: 'qop', value: 'auth', isQuoted: true },
          { name: 'nonce', value: 'abc123', isQuoted: true },
        ],
      },
    ]);
  });

  it('parses multiple challenges in a single header', () => {
    const headerValue = 'Basic, Bearer abc123';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([
      { scheme: 'Basic', parameters: [] },
      { scheme: 'Bearer', token68: 'abc123', parameters: [] },
    ]);
  });

  it('handles empty header value gracefully', () => {
    const headerValue = '';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([]);
  });

  it('ignores whitespace around challenges and parameters', () => {
    const headerValue = '   Basic   ,   Digest   realm="example.com"   ';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([
      { scheme: 'Basic', parameters: [] },
      {
        scheme: 'Digest',
        parameters: [{ name: 'realm', value: 'example.com', isQuoted: true }],
      },
    ]);
  });

  it('supports challenges with only parameters (continuation)', () => {
    const headerValue = 'Digest realm="example.com", qop="auth"';
    const result = parseChallenges(headerValue);

    expect(result).toEqual<Challenge[]>([
      {
        scheme: 'Digest',
        parameters: [
          { name: 'realm', value: 'example.com', isQuoted: true },
          { name: 'qop', value: 'auth', isQuoted: true },
        ],
      },
    ]);
  });
});
