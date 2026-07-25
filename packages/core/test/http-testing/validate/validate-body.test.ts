import { describe, expect, it } from 'vitest';

import type { ThymianHttpResponse } from '../../../src/format/nodes/http-response.node.js';
import {
  validateBodyForResponse,
  validateJsonBody,
} from '../../../src/http-testing/validate/validate-body.js';

describe('validateJsonBody', () => {
  it('validates payloads against self-contained $defs schemas', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        type: 'object',
        required: ['user'],
        properties: {
          user: {
            $ref: '#/$defs/User',
          },
        },
        $defs: {
          User: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
    };

    expect(validateJsonBody('{"user":{"name":"Ada"}}', response)).toStrictEqual(
      [
        {
          type: 'assertion-success',
          message: 'Valid response body.',
          timestamp: expect.any(Number),
        },
      ],
    );
  });

  it('reports invalid payloads for self-contained $defs schemas', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        type: 'object',
        required: ['user'],
        properties: {
          user: {
            $ref: '#/$defs/User',
          },
        },
        $defs: {
          User: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
            },
          },
        },
      },
    };

    expect(validateJsonBody('{"user":{}}', response)).toStrictEqual([
      {
        type: 'assertion-failure',
        message: 'property "user.name" is required',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('emits one assertion-failure per schema error', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    };

    // The payload is missing both required properties → two distinct errors.
    const results = validateJsonBody('{}', response);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.type === 'assertion-failure')).toBe(true);
    expect(results.map((r) => r.message)).toEqual(
      expect.arrayContaining([
        'property "name" is required',
        'property "email" is required',
      ]),
    );
  });

  it('reports the expected constraint and actual value for a type mismatch', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        type: 'object',
        properties: {
          age: { type: 'integer' },
        },
      },
    };

    expect(validateJsonBody('{"age":1.2}', response)).toStrictEqual([
      {
        type: 'assertion-failure',
        message: 'property "age" must be integer',
        expected: 'integer',
        actual: 1.2,
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('supports recursive schemas without circular in-memory references', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: {
        $ref: '#/$defs/Node',
        $defs: {
          Node: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              child: { $ref: '#/$defs/Node' },
            },
          },
        },
      },
    };

    expect(
      validateJsonBody('{"name":"root","child":{"name":"leaf"}}', response),
    ).toStrictEqual([
      {
        type: 'assertion-success',
        message: 'Valid response body.',
        timestamp: expect.any(Number),
      },
    ]);
  });
});

describe('validateBodyForResponse', () => {
  it('returns info for non-json bodies', () => {
    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'text/plain',
      statusCode: 200,
    };

    expect(validateBodyForResponse('hello', response)).toStrictEqual([
      {
        type: 'info',
        message: 'Non JSON response body cannot be validated.',
        timestamp: expect.any(Number),
        details: '',
      },
    ]);
  });
});
