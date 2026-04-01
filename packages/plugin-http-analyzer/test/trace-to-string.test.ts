import {
  type CapturedTrace,
  capturedTraceToString,
  httpTransactionToLabel,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

describe('capturedTraceToString', () => {
  it('should return empty string for empty trace', () => {
    const emptyTrace: CapturedTrace = [];
    const result = capturedTraceToString(emptyTrace);
    expect(result).toBe('');
  });

  it('should format single transaction trace', () => {
    const trace: CapturedTrace = [
      {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/users',
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      },
    ];

    const result = capturedTraceToString(trace);
    expect(result).toStrictEqual(
      httpTransactionToLabel(trace[0]!.request.data, trace[0]!.response.data),
    );
  });

  it('should format two-transaction trace with arrows', () => {
    const trace: CapturedTrace = [
      {
        request: {
          data: {
            method: 'GET',
            origin: 'https://proxy.example.com',
            path: '/api',
          },
          meta: { role: 'proxy' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 50,
          },
          meta: { role: 'proxy' },
        },
      },
      {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/api',
          },
          meta: { role: 'origin server' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 50,
          },
          meta: { role: 'origin server' },
        },
      },
    ];

    const result = capturedTraceToString(trace);
    expect(result).toContain('->');
    expect(result).toContain('proxy.example.com');
    expect(result).toContain('api.example.com');
  });

  it('should format multi-transaction trace (length > 2)', () => {
    const trace: CapturedTrace = [
      {
        request: {
          data: {
            method: 'POST',
            origin: 'https://client.example.com',
            path: '/start',
          },
          meta: { role: 'user-agent' },
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: { role: 'user-agent' },
        },
      },
      {
        request: {
          data: {
            method: 'POST',
            origin: 'https://proxy.example.com',
            path: '/middle',
          },
          meta: { role: 'proxy' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 80,
          },
          meta: { role: 'proxy' },
        },
      },
      {
        request: {
          data: {
            method: 'POST',
            origin: 'https://api.example.com',
            path: '/end',
          },
          meta: { role: 'origin server' },
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            duration: 60,
          },
          meta: { role: 'origin server' },
        },
      },
    ];

    const result = capturedTraceToString(trace);
    expect(result).toContain('POST');
    expect(result).toContain('->');
    expect(result).toContain('client.example.com');
    expect(result).toContain('api.example.com');
    expect(result).toContain('201');
    expect(result).toContain('1x more');
  });
});
