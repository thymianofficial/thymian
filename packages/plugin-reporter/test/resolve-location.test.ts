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

  it('never attributes the single format entry to a run without a version (merged reports carry foreign formats)', () => {
    const format = new ThymianFormat();
    const requestId = format.addRequest(REQUEST);

    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      thymianFormat: { 'only-version': format.export() },
    });

    // No runVersion passed at all — in a merged report the sole entry may
    // belong to a *different* input, so resolution must degrade to the raw
    // fallback text instead of rendering against a foreign API graph.
    // (Missing versions are completed at assembly time, where provenance is
    // known — see Thymian.finalizeWorkflow/reportConvert.)
    const result = resolve({
      type: 'thymianFormat',
      elementType: 'node',
      elementId: requestId,
      pointer: '',
    });

    expect(result).toBe(`format:${requestId}`);
  });

  it('never attributes the single format entry to a run whose version does not match it', () => {
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

    expect(result).toBe(`format:${requestId}`);
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

  it('falls back to the raw format:{elementId} string when the serialized format is malformed', () => {
    const resolve = createLocationResolver({
      reportId: 'r-1',
      createdAt: new Date(0).toISOString(),
      runs: [],
      // Not a valid SerializedThymianFormat — graphology's `import()` throws
      // because `nodes` must be an array.
      thymianFormat: { v1: { nodes: 'not-an-array' } as never },
    });

    const result = resolve(
      {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: 'abc123',
        pointer: '',
      },
      'v1',
    );

    expect(result).toBe('format:abc123');
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
