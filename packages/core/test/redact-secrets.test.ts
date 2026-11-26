import { describe, expect, it } from 'vitest';

import { stringifyRedacted } from '../src/redact-secrets.js';

describe('stringifyRedacted', () => {
  it('redacts credentials at any depth and keeps everything else', () => {
    const serialized = stringifyRedacted({
      port: 51234,
      plugins: [
        { name: 'remote-plugin', token: 's3cr3t', options: { apiKey: 'k3y' } },
      ],
      auth: { client_secret: 'hidden', Authorization: 'Bearer abc' },
      password: 'pw',
    });

    expect(JSON.parse(serialized)).toEqual({
      port: 51234,
      plugins: [
        {
          name: 'remote-plugin',
          token: '<redacted>',
          options: { apiKey: '<redacted>' },
        },
      ],
      auth: { client_secret: '<redacted>', Authorization: '<redacted>' },
      password: '<redacted>',
    });
    expect(serialized).not.toMatch(/s3cr3t|k3y|hidden|Bearer abc|"pw"/);
  });

  it.each(['privateKey', 'private_key', 'cookie', 'bearer', 'pwd', 'jwt'])(
    'redacts the value of "%s"',
    (key) => {
      expect(JSON.parse(stringifyRedacted({ [key]: 'value' }))).toEqual({
        [key]: '<redacted>',
      });
    },
  );

  it('redacts a list or object of credentials as a whole', () => {
    expect(
      JSON.parse(
        stringifyRedacted({ tokens: ['a', 'b'], secrets: { a: 'b' } }),
      ),
    ).toEqual({ tokens: '<redacted>', secrets: '<redacted>' });
  });

  it('keeps numeric and boolean settings whose name only looks like a credential', () => {
    expect(stringifyRedacted({ maxTokens: 4096, useCookies: true })).toBe(
      '{"maxTokens":4096,"useCookies":true}',
    );
  });

  it('keeps an unset credential visible as unset', () => {
    expect(stringifyRedacted({ token: null, name: 'a' })).toBe(
      '{"token":null,"name":"a"}',
    );
  });
});
