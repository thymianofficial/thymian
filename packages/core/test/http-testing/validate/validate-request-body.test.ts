import { describe, expect, it } from 'vitest';

import type { ThymianHttpRequest } from '../../../src/format/nodes/http-request.node.js';
import { validateJsonRequestBody } from '../../../src/http-testing/validate/validate-request-body.js';

function createRequest(schema: unknown): ThymianHttpRequest {
  return {
    type: 'http-request',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    path: '/users',
    method: 'POST',
    headers: {},
    queryParameters: {},
    cookies: {},
    pathParameters: {},
    bodyRequired: true,
    body: schema as ThymianHttpRequest['body'],
    mediaType: 'application/json',
    label: '',
    sourceName: '',
  };
}

describe('validateJsonRequestBody', () => {
  it('returns assertion-success for a valid body', () => {
    const request = createRequest({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    });

    const results = validateJsonRequestBody('{"name":"Ada"}', request);

    expect(results).toStrictEqual([
      {
        type: 'assertion-success',
        message: 'Valid request body.',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('emits one assertion-failure per schema error', () => {
    const request = createRequest({
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
    });

    const results = validateJsonRequestBody('{}', request);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.type === 'assertion-failure')).toBe(true);
    expect(results.map((r) => r.message)).toEqual(
      expect.arrayContaining([
        'property "name" is required',
        'property "email" is required',
      ]),
    );
  });

  it('reports invalid JSON as a single assertion-failure', () => {
    const request = createRequest({ type: 'object' });

    const results = validateJsonRequestBody('{not json', request);

    expect(results).toStrictEqual([
      {
        type: 'assertion-failure',
        message: 'Request body is not valid JSON.',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('returns info when no request body schema is provided', () => {
    const request = createRequest(undefined);

    const results = validateJsonRequestBody('{"name":"Ada"}', request);

    expect(results).toStrictEqual([
      {
        type: 'info',
        message: 'No request body schema is provided.',
        details: '',
        timestamp: expect.any(Number),
      },
    ]);
  });
});
