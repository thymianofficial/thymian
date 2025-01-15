import { describe, expect, it } from 'vitest';
import { encodeResponseBody } from '../src/encode.js';

describe('encodeResponseBody', () => {
  it('should encode application/json; charset=utf-8', () => {
    const encoded = encodeResponseBody(
      Buffer.from('{"test":1}'),
      'application/json; charset=utf-8'
    );

    expect(encoded.encoding).toBe('utf-8');
    expect(encoded.str).toBe('{"test":1}');
    expect(JSON.parse(encoded.str)).toStrictEqual({ test: 1 });
  });

  it('should encode image/png in base64', () => {
    const encoded = encodeResponseBody(
      new Uint8Array([43, 22, 23, 12]),
      'image/png'
    );

    expect(encoded.encoding).toBe('base64');
    expect(encoded.str).toBe('KxYXDA==');
  });

  it('should encode text/plain; charset=ISO-8859-1', () => {
    const encoded = encodeResponseBody(
      Buffer.from('Hello, World!'),
      'text/plain; charset=ISO-8859-1'
    );

    expect(encoded.encoding).toBe('ISO-8859-1');
    expect(encoded.str).toBe('Hello, World!');
  });

  it.each([['image/png'], ['video/mp4'], ['audio/mp3']])(
    'should encode %s as base64',
    (type) => {
      const encoded = encodeResponseBody(
        new Uint8Array([43, 22, 23, 12]),
        type
      );

      expect(encoded.encoding).toBe('base64');
    }
  );
});
