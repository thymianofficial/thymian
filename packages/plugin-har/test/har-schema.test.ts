import { describe, expect, it } from 'vitest';

import { getValidationErrors, validateHar } from '../src/har-schema.js';

function createValidHar() {
  return {
    log: {
      version: '1.2',
      entries: [
        {
          time: 42,
          request: {
            method: 'GET',
            url: 'https://api.example.com/users',
            headers: [{ name: 'Accept', value: 'application/json' }],
          },
          response: {
            status: 200,
            headers: [{ name: 'Content-Type', value: 'application/json' }],
            content: { size: 8, text: '{"id":1}' },
          },
        },
      ],
    },
  };
}

describe('har-schema', () => {
  it('validateHar should accept a valid HAR payload', () => {
    expect(validateHar(createValidHar())).toBe(true);
  });

  it('validateHar should accept HAR payloads without log.version', () => {
    const har = createValidHar();
    // @ts-expect-error test invalid payload
    delete har.log.version;

    expect(validateHar(har)).toBe(true);
  });

  it('validateHar should reject invalid response content types', () => {
    const har = createValidHar();
    har.log.entries[0]!.response!.content.size = '8' as never;

    expect(validateHar(har)).toBe(false);
    expect(getValidationErrors()).toContain(
      '/log/entries/0/response/content/size',
    );
  });

  it('validateHar should allow entries without a response', () => {
    const har = createValidHar();
    delete har.log.entries[0]!.response;

    expect(validateHar(har)).toBe(true);
  });

  it('validateHar should accept sparse HAR objects with all fields omitted', () => {
    expect(validateHar({})).toBe(true);
  });

  it('validateHar should reject non-object payloads', () => {
    expect(validateHar('not-a-har')).toBe(false);
    expect(getValidationErrors()).toContain('must be object');
  });
});
