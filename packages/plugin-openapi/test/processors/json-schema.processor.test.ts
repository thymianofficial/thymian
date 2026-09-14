import { type ThymianHttpResponse, validateJsonBody } from '@thymian/core';
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

  it('should remove the xml keyword', () => {
    const schema: OpenApiV31.SchemaObject = {
      type: 'string',
      xml: { name: 'animal' },
    };

    expect(
      processSchema(schema as Draft202012SchemaObject, {
        document: emptyDocument,
      }),
    ).toStrictEqual({
      type: 'string',
    });
  });

  it('should remove specification extensions at every depth', () => {
    const schema = {
      type: 'object',
      'x-error-category': 'validation',
      properties: {
        status: {
          type: 'string',
          enum: ['running', 'stopped'],
          'x-enumNames': ['Running', 'Stopped'],
        },
        entries: {
          type: 'array',
          'x-csv-element-schema': { type: 'string' },
          items: {
            type: 'number',
            'x-precision': 2,
          },
        },
      },
      allOf: [
        {
          type: 'object',
          'x-requires_permission': 'admin',
        },
      ],
    } as Draft202012SchemaObject;

    expect(
      processSchema(schema, {
        document: emptyDocument,
      }),
    ).toStrictEqual({
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['running', 'stopped'],
        },
        entries: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      },
      allOf: [
        {
          type: 'object',
        },
      ],
    });
  });

  it('should remove specification extensions inside localized $defs targets', () => {
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
            'x-requires_module': 'users',
            properties: {
              name: {
                type: 'string',
                'x-feature-flag': 'new-names',
              },
            },
          } as OpenApiV31.SchemaObject,
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
            },
          },
        },
      },
    });
  });

  it('produces schemas that Ajv strict mode can validate despite x-* extensions in the source', () => {
    const document: OpenApiV31.Document = {
      openapi: '3.1.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          Entry: {
            type: 'object',
            'x-requires_module': 'entries',
            properties: {
              duration: {
                type: 'number',
                'x-precision': 2,
              },
            },
          } as OpenApiV31.SchemaObject,
        },
      },
    };

    const schema = {
      type: 'object',
      'x-error-category': 'validation',
      properties: {
        entry: {
          $ref: '#/components/schemas/Entry',
        },
      },
    } as Draft202012SchemaObject;

    const response: ThymianHttpResponse = {
      type: 'http-response',
      label: '200 OK',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      schema: processSchema(schema, { document }),
    };

    expect(
      validateJsonBody('{"entry":{"duration":1.25}}', response),
    ).toStrictEqual([
      {
        type: 'assertion-success',
        message: 'Valid response body.',
        timestamp: expect.any(Number),
      },
    ]);
  });
});
