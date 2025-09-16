import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import {
  type Draft202012SchemaObject,
  processSchema,
} from '../../src/processors/json-schema.processor.js';

describe('processSchema', () => {
  it('should remove example keyword and move value to examples', () => {
    const schema: OpenApiV31.SchemaObject = {
      type: 'string',
      example: 'turing',
    };

    expect(processSchema(schema as Draft202012SchemaObject)).toStrictEqual({
      type: 'string',
      examples: ['turing'],
    });
  });
});
