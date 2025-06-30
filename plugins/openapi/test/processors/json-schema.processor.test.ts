import { describe, expect, it } from 'vitest';

import {
  type Draft202012SchemaObject,
  processSchema,
} from '../../src/processors/json-schema.processor.js';

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
