import { ThymianFormat } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { createLocationResolver } from '../src/formatters/resolve-location.js';

const REQUEST = {
  sourceName: 'openapi.yaml',
  protocol: 'https' as const,
  host: 'api.example.com',
  port: 443,
  method: 'post',
  path: '/orders',
  mediaType: '',
  headers: {},
  queryParameters: {},
  cookies: {},
  pathParameters: {},
};

const RESPONSE = {
  statusCode: 200,
  mediaType: '',
  headers: {},
};

describe('createLocationResolver (AC13)', () => {
  it('resolves a thymianFormat node location to an endpoint string', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest(REQUEST);

    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      thymianFormat: { v1: format.export() },
    });

    const result = resolve(
      {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: requestId,
        pointer: '',
      },
      'v1',
    );

    expect(result).toBe('POST /orders');
  });

  it('resolves a thymianFormat edge location to a request → response string', () => {
    const format = new ThymianFormat();
    const [, , transactionId] = format.addHttpTransaction(
      REQUEST,
      RESPONSE,
      'openapi.yaml',
    );

    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      thymianFormat: { v1: format.export() },
    });

    const result = resolve(
      {
        type: 'thymianFormat',
        elementType: 'edge',
        elementId: transactionId,
        pointer: '',
      },
      'v1',
    );

    expect(result).toBe('POST /orders → 200 OK');
  });

  it('falls back to the single format entry when no runVersion is given (defense-in-depth)', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest(REQUEST);

    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      thymianFormat: { 'only-version': format.export() },
    });

    // No runVersion passed at all — mirrors a producer that never set
    // `ToolRun.thymianFormatVersion`.
    const result = resolve({
      type: 'thymianFormat',
      elementType: 'node',
      elementId: requestId,
      pointer: '',
    });

    expect(result).toBe('POST /orders');
  });

  it('falls back to the single format entry when runVersion does not match it', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest(REQUEST);

    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      thymianFormat: { 'only-version': format.export() },
    });

    const result = resolve(
      {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: requestId,
        pointer: '',
      },
      'mismatched-version',
    );

    expect(result).toBe('POST /orders');
  });

  it('falls back to the raw format:{elementId} string when no version matches', () => {
    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
    });

    const result = resolve(
      {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: 'missing',
        pointer: '',
      },
      'no-such-version',
    );

    expect(result).toBe('format:missing');
  });

  it('delegates non-thymianFormat locations to plain formatting', () => {
    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
    });

    expect(resolve({ type: 'custom', value: 'GET /pets' })).toBe('GET /pets');
    expect(resolve({ type: 'url', url: 'https://example.com' })).toBe(
      'https://example.com',
    );
    expect(resolve({ type: 'file', path: 'a.ts', line: 3, column: 5 })).toBe(
      'a.ts:3:5',
    );
  });
});
