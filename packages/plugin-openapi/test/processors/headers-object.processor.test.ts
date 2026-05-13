import { HeaderSerializationStyleBuilder, type Parameter } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { processHeadersObject } from '../../src/processors/headers-object.processor.js';

const document = {
  openapi: '3.1.1',
  info: {
    title: 'test',
    version: '1.0.0',
  },
  paths: {},
} as const;

describe('processHeadersObject', () => {
  it('should return empty record for undefined', () => {
    const result = processHeadersObject(undefined, document);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should return empty record for no headers', () => {
    const result = processHeadersObject({}, document);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should ignore content-type header by default', () => {
    const result = processHeadersObject(
      {
        'content-type': {},
        accept: {
          schema: {
            type: 'string',
            example: 'application/json',
          },
        },
      },
      document,
    );

    expect(Object.keys(result)).toHaveLength(1);
    expect(result['accept']).toBeDefined();
    expect(result['accept']).toStrictEqual({
      style: new HeaderSerializationStyleBuilder().build(),
      schema: { type: 'string', examples: ['application/json'] },
      required: false,
    } satisfies Parameter);
  });

  it('should not ignore content-type header if flag is set', () => {
    const result = processHeadersObject(
      {
        'content-type': {
          schema: {
            type: 'string',
          },
        },
        accept: {
          schema: {
            type: 'string',
            example: 'application/json',
          },
        },
      },
      document,
      false,
    );

    expect(Object.keys(result)).toHaveLength(2);
  });

  it('should throw error if no schema or content is set', () => {
    expect(() => processHeadersObject({ accept: {} }, document)).toThrowError();
  });

  it('should resolve referenced headers from the document', () => {
    const result = processHeadersObject(
      {
        accept: { $ref: '#/components/headers/Accept' },
      },
      {
        ...document,
        components: {
          headers: {
            Accept: {
              schema: {
                type: 'string',
              },
            },
          },
        },
      },
    );

    expect(result.accept).toMatchObject({
      schema: { type: 'string' },
      required: false,
    });
  });
});
