import { describe, it, expect, test } from 'vitest';
import {
  type Draft202012SchemaObject,
  processSchema,
} from '../../src/processors/json-schema.processor.js';
import {} from '@thymian/core';

describe('processSchema', () => {
  it('should remove example keyword and move value to examples', () => {
    const schema: Draft202012SchemaObject = {
      type: 'string',
      example: 'turing',
    };

    expect(processSchema(schema)).toStrictEqual({
      type: 'string',
      examples: ['turing'],
    });
  });
});
