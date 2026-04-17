import { describe, expect, it } from 'vitest';

import {
  parseUrl,
  transformHar,
  transformHarEntry,
  transformHarHeaders,
} from '../src/har-transformer.js';
import type { HarEntry, HarHeader, HarLog } from '../src/har-types.js';

describe('transformHarHeaders', () => {
  it('should transform single headers', () => {
    const headers: HarHeader[] = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Accept', value: 'text/html' },
    ];

    const result = transformHarHeaders(headers);

    expect(result).toEqual({
      'content-type': 'application/json',
      accept: 'text/html',
    });
  });

  it('should collect duplicate headers into an array', () => {
    const headers: HarHeader[] = [
      { name: 'Set-Cookie', value: 'a=1' },
      { name: 'Set-Cookie', value: 'b=2' },
    ];

    const result = transformHarHeaders(headers);

    expect(result).toEqual({
      'set-cookie': ['a=1', 'b=2'],
    });
  });

  it('should return empty object for empty array', () => {
    expect(transformHarHeaders([])).toEqual({});
  });
});

describe('parseUrl', () => {
  it('should extract origin and path, stripping query params', () => {
    const result = parseUrl('https://api.example.com/users?page=1');

    expect(result).toEqual({
      origin: 'https://api.example.com',
      path: '/users',
    });
  });

  it('should handle URL with port', () => {
    const result = parseUrl('http://localhost:3000/api/v1');

    expect(result).toEqual({
      origin: 'http://localhost:3000',
      path: '/api/v1',
    });
  });

  it('should handle URL with path only', () => {
    const result = parseUrl('https://example.com/');

    expect(result).toEqual({
      origin: 'https://example.com',
      path: '/',
    });
  });
});

describe('transformHarEntry', () => {
  const baseEntry: HarEntry = {
    request: {
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [{ name: 'Accept', value: 'application/json' }],
    },
    response: {
      status: 200,
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      content: { text: '{"id":1}', size: 8 },
    },
    time: 42,
  };

  it('should transform a complete entry into CapturedTransaction', () => {
    const result = transformHarEntry(baseEntry);

    expect(result).toEqual({
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users',
          headers: { accept: 'application/json' },
          body: undefined,
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: '{"id":1}',
          bodyEncoding: undefined,
          trailers: {},
          duration: 42,
        },
        meta: {},
      },
    });
  });

  it('should return null for entry without response', () => {
    const entry: HarEntry = {
      request: { method: 'GET', url: 'https://example.com/', headers: [] },
      time: 0,
    };

    expect(transformHarEntry(entry)).toBeNull();
  });

  it('should map postData.text to body', () => {
    const entry: HarEntry = {
      ...baseEntry,
      request: {
        ...baseEntry.request,
        method: 'POST',
        postData: { text: '{"name":"test"}', mimeType: 'application/json' },
      },
    };

    const result = transformHarEntry(entry);
    expect(result?.request.data.body).toBe('{"name":"test"}');
  });

  it('should map content.encoding to bodyEncoding', () => {
    const entry: HarEntry = {
      ...baseEntry,
      response: {
        ...baseEntry.response!,
        content: { ...baseEntry.response!.content, encoding: 'base64' },
      },
    };

    const result = transformHarEntry(entry);
    expect(result?.response.data.bodyEncoding).toBe('base64');
  });

  it('should lowercase the method', () => {
    const result = transformHarEntry(baseEntry);
    expect(result?.request.data.method).toBe('get');
  });

  it('should return null for malformed URL', () => {
    const entry: HarEntry = {
      ...baseEntry,
      request: { ...baseEntry.request, url: 'not-a-valid-url' },
    };

    expect(transformHarEntry(entry)).toBeNull();
  });
});

describe('transformHar', () => {
  it('should transform multiple entries', () => {
    const har: HarLog = {
      log: {
        version: '1.2',
        entries: [
          {
            request: {
              method: 'GET',
              url: 'https://example.com/a',
              headers: [],
            },
            response: {
              status: 200,
              headers: [],
              content: { size: 0 },
            },
            time: 10,
          },
          {
            request: {
              method: 'POST',
              url: 'https://example.com/b',
              headers: [],
            },
            response: {
              status: 201,
              headers: [],
              content: { size: 0 },
            },
            time: 20,
          },
        ],
      },
    };

    const result = transformHar(har);

    expect(result.transactions).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
  });

  it('should count skipped entries without responses', () => {
    const har: HarLog = {
      log: {
        version: '1.2',
        entries: [
          {
            request: {
              method: 'GET',
              url: 'https://example.com/a',
              headers: [],
            },
            response: {
              status: 200,
              headers: [],
              content: { size: 0 },
            },
            time: 10,
          },
          {
            request: {
              method: 'GET',
              url: 'https://example.com/b',
              headers: [],
            },
            time: 0,
          },
        ],
      },
    };

    const result = transformHar(har);

    expect(result.transactions).toHaveLength(1);
    expect(result.skippedCount).toBe(1);
  });

  it('should handle empty entries array', () => {
    const har: HarLog = { log: { version: '1.2', entries: [] } };

    const result = transformHar(har);

    expect(result.transactions).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });
});
