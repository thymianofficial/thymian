import { HeaderSerializationStyleBuilder, type Parameter } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { processHeadersObject } from '../../src/processors/headers-object.processor.js';

describe('processHeadersObject', () => {
  it('should return empty record for undefined', () => {
    const result = processHeadersObject(undefined);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should return empty record for no headers', () => {
    const result = processHeadersObject({});

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should ignore content-type header by default', () => {
    const result = processHeadersObject({
      'content-type': {},
      accept: {
        schema: {
          type: 'string',
          example: 'application/json',
        },
      },
    });

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
      false,
    );

    expect(Object.keys(result)).toHaveLength(2);
  });

  it('should throw error if no schema or content is set', () => {
    expect(() => processHeadersObject({ accept: {} })).toThrowError();
  });
});
