import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import {
  type Draft202012SchemaObject,
  processSchema,
} from '../../src/processors/json-schema.processor.js';

const emptyDocument: OpenApiV31.Document = {
  openapi: '3.1.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {},
};

describe('processSchema', () => {
  it('should remove example keyword and move value to examples', () => {
    const schema: OpenApiV31.SchemaObject = {
      type: 'string',
      example: 'turing',
    };

    expect(
      processSchema(schema as Draft202012SchemaObject, {
        document: emptyDocument,
      }),
    ).toStrictEqual({
      type: 'string',
      examples: ['turing'],
    });
  });

  it('should localize component references into self-contained $defs', () => {
    const document: OpenApiV31.Document = {
      openapi: '3.1.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                example: 'Ada',
              },
            },
          },
        },
      },
    };

    const schema: OpenApiV31.SchemaObject = {
      type: 'object',
      properties: {
        user: {
          $ref: '#/components/schemas/User',
        },
      },
    };

    expect(
      processSchema(schema as Draft202012SchemaObject, { document }),
    ).toStrictEqual({
      type: 'object',
      properties: {
        user: {
          $ref: '#/$defs/User',
        },
      },
      $defs: {
        User: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              examples: ['Ada'],
            },
          },
        },
      },
    });
  });

  it('should preserve recursive references through localized $defs', () => {
    const document: OpenApiV31.Document = {
      openapi: '3.1.0',
      info: {
        title: 'Recursive API',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              child: {
                $ref: '#/components/schemas/Node',
              },
            },
          },
        },
      },
    };

    expect(
      processSchema(
        {
          $ref: '#/components/schemas/Node',
        } as Draft202012SchemaObject,
        { document },
      ),
    ).toStrictEqual({
      $ref: '#/$defs/Node',
      $defs: {
        Node: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            child: {
              $ref: '#/$defs/Node',
            },
          },
        },
      },
    });
  });

  it('should remove OpenAPI-only keywords while preserving examples', () => {
    const schema: OpenApiV31.SchemaObject = {
      type: 'object',
      nullable: true,
      readOnly: true,
      properties: {
        name: {
          type: 'string',
          example: 'Grace',
          writeOnly: true,
        },
      },
    };

    expect(
      processSchema(schema as Draft202012SchemaObject, {
        document: emptyDocument,
      }),
    ).toStrictEqual({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          examples: ['Grace'],
        },
      },
    });
  });
});
