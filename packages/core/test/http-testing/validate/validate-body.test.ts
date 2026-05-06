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
            },
          },
        },
      },
    };

    expect(validateJsonBody('{"user":{}}', response)).toStrictEqual([
      {
        type: 'assertion-failure',
        message:
          "Invalid response body: /user must have required property 'name'",
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
