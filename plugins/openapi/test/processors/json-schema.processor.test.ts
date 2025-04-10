import { describe, it, expect, test } from 'vitest';
import {
  type Draft202012SchemaObject,
  processSchema,
} from '../../src/processors/json-schema.processor.js';
import {
  ArraySchema,
  BooleanSchema,
  EmptySchema,
  IntegerSchema,
  MultiTypeSchema,
  NumberSchema,
  ObjectSchema,
  StringSchema,
  ThymianSchema,
} from '@thymian/core';
import type { OpenAPIV3 } from 'openapi-types';

describe('processSchema', () => {
  it('should create boolean json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'boolean',
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(BooleanSchema);
    expect(schema).toEqual(new BooleanSchema());
  });

  it('should create string json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'string',
      maxLength: 10,
      minLength: 1,
      pattern: 'pattern',
      format: 'email',
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(
      new StringSchema()
        .withFormat('email')
        .withMaxLength(10)
        .withMinLength(1)
        .withPattern('pattern')
    );
  });

  it('should create nullable string json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: ['string', 'null'],
      maxLength: 10,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(MultiTypeSchema);
    expect(schema).toEqual(
      new MultiTypeSchema()
        .withSchema(new StringSchema().withMaxLength(10))
        .nullable()
        .withType('string', 'null')
    );
  });

  test.each(['pattern', 'maxLength', 'minLength'])(
    'should create string json-schema for string specific keyword %s',
    (keyword) => {
      const schemaObj: Draft202012SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj);

      expect(schema).toBeInstanceOf(StringSchema);
    }
  );

  it('should create number json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'number',
      multipleOf: 11,
      maximum: 10,
      exclusiveMinimum: 2,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(NumberSchema);
    expect(schema).toEqual(
      new NumberSchema()
        .withMultipleOf(11)
        .withMaximum(10)
        .witheExclusiveMinimum(2)
    );
  });

  test.each([
    'multipleOf',
    'maximum',
    'minimum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ])(
    'should create number json-schema for number specific keyword %s',
    (keyword) => {
      const schemaObj: Draft202012SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj);

      expect(schema).toBeInstanceOf(NumberSchema);
    }
  );

  it('should create integer json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'integer',
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(IntegerSchema);
    expect(schema).toEqual(new IntegerSchema());
  });

  it('should create object json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'object',
      properties: {
        a: {
          type: 'string',
        },
        b: {
          type: 'boolean',
        },
      },
      additionalProperties: false,
      minProperties: 1,
      maxProperties: 3,
      required: ['a'],
      patternProperties: {
        '^image.*': {
          type: 'string',
          contentMediaType: 'image/*',
        },
      },
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ObjectSchema);
    expect(schema).toEqual(
      new ObjectSchema()
        .withRequiredProperty('a', new StringSchema())
        .withProperty('b', new BooleanSchema())
        .withAdditionalProperties(false)
        .withMinProperties(1)
        .withMaxProperties(3)
        .withPatternProperty(
          '^image.*',
          new StringSchema().withContentMediaType('image/*')
        )
    );
  });

  test.each([
    'properties',
    'required',
    'additionalProperties',
    'minProperties',
    'maxProperties',
    'patternProperties',
    'unevaluatedProperties',
  ])(
    'should create object json-schema for object specific keyword %s',
    (keyword) => {
      const schemaObj: Draft202012SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj);

      expect(schema).toBeInstanceOf(ObjectSchema);
    }
  );

  it('should create array json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      maxItems: 20,
      minItems: 3,
      unevaluatedItems: true,
      prefixItems: [
        {
          type: 'boolean',
        },
      ],
      contains: {
        type: 'string',
      },
      minContains: 1,
      maxContains: 5,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ArraySchema);
    expect(schema).toEqual(
      new ArraySchema()
        .withItems(new StringSchema())
        .withMaxItems(20)
        .withMinItems(3)
        .unique(true)
        .withPrefixItems([new BooleanSchema()])
        .withContains(new StringSchema())
        .withMinContains(1)
        .withMaxContains(5)
        .allowUnevaluatedItems(true)
    );
  });

  test.each([
    'items',
    'uniqueItems',
    'maxItems',
    'minItems',
    'unevaluatedItems',
    'prefixItems',
    'contains',
    'minContains',
    'maxContains',
  ])(
    'should create array json-schema for array specific keyword %s',
    (keyword) => {
      const schemaObj: Draft202012SchemaObject = {
        [keyword]: [],
      };

      const schema = processSchema(schemaObj);

      expect(schema).toBeInstanceOf(ArraySchema);
    }
  );

  it('should set enum value', () => {
    const schemaObj: Draft202012SchemaObject = {
      enum: ['constVal'],
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(new ThymianSchema().withEnum('constVal'));
  });

  it('should process oneOf correctly', () => {
    const schemaObj: Draft202012SchemaObject = {
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(
      new ThymianSchema().withOneOf([new StringSchema(), new NumberSchema()])
    );
  });

  it('should create multi type json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      minimum: 10,
      maximum: 20,
      minLength: 3,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(MultiTypeSchema);
    expect(schema).toEqual(
      new MultiTypeSchema()
        .withSchema(new StringSchema().withMinLength(3))
        .withSchema(new NumberSchema().withMinimum(10).withMaximum(20))
        .withType('string', 'number')
    );
  });

  it('should process not correctly', () => {
    const schemaObj: Draft202012SchemaObject = {
      not: {
        oneOf: [
          {
            type: 'array',
            items: {},
          },
          {
            type: 'object',
          },
        ],
      },
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(
      new ThymianSchema().withNot(
        new ThymianSchema().withOneOf([
          new ArraySchema().withItems(new EmptySchema()),
          new ObjectSchema(),
        ])
      )
    );
  });

  it('should process nested json-schema correctly', () => {
    const schemaObj: Draft202012SchemaObject = {
      properties: {
        objProp: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                arr: {
                  type: 'array',
                  items: {
                    type: 'integer',
                    format: 'int32',
                  },
                  oneOf: [
                    {
                      maxItems: 20,
                      minItems: 10,
                    },
                    {
                      maxItems: 40,
                      minItems: 30,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ObjectSchema);
    expect(schema).toEqual(
      new ObjectSchema().withProperty(
        'objProp',
        new ObjectSchema().withProperty(
          'nested',
          new ObjectSchema().withProperty(
            'arr',
            new ArraySchema()
              .withItems(new IntegerSchema().withFormat('int32'))
              .withOneOf([
                new ArraySchema().withMinItems(10).withMaxItems(20),
                new ArraySchema().withMinItems(30).withMaxItems(40),
              ])
          )
        )
      )
    );
  });

  it('should ignore keywords of other types', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'string',
      minimum: 2,
      maxLength: 3,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(new StringSchema().withMaxLength(3));
  });

  it('should create json-schema for each specified type', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: ['string', 'integer', 'null'],
      minimum: 2,
      maxLength: 3,
      multipleOf: 10,
      pattern: 'pattern',
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(MultiTypeSchema);
    expect(schema).toEqual(
      new MultiTypeSchema()
        .withSchema(new StringSchema().withPattern('pattern').withMaxLength(3))
        .withSchema(new IntegerSchema().withMinimum(2).withMultipleOf(10))
        .nullable()
    );
  });

  it('should set const', () => {
    const schemaObj: Draft202012SchemaObject = {
      const: {
        name: 'newton',
      },
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(new ThymianSchema().withConst({ name: 'newton' }));
  });

  it('should create correct schema for multipart type', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'object',
      properties: {
        str: {
          type: 'string',
        },
        image: {
          type: 'string',
          contentMediaType: 'image/png',
          // This is correct but a bug in openapi-types. Maybe we should for the project?
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          contentEncoding: 'base64',
        },
      },
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(ObjectSchema);
    expect(schema).toEqual(
      new ObjectSchema()
        .withProperty('str', new StringSchema())
        .withProperty(
          'image',
          new StringSchema()
            .withContentMediaType('image/png')
            .withContentEncoding('base64')
        )
    );
  });

  it('should create boolean json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'boolean',
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(BooleanSchema);
    expect(schema).toEqual(new BooleanSchema());
  });

  it('should create string json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'string',
      maxLength: 10,
      minLength: 1,
      pattern: 'pattern',
      format: 'email',
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(
      new StringSchema()
        .withFormat('email')
        .withMaxLength(10)
        .withMinLength(1)
        .withPattern('pattern')
    );
  });

  it('should create nullable string json-schema', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: ['string', 'null'],
      maxLength: 10,
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(MultiTypeSchema);
    expect(schema).toEqual(
      new MultiTypeSchema()
        .withSchema(new StringSchema().withMaxLength(10))
        .nullable()
        .withType('string', 'null')
    );
  });

  it('should set content media type for binary format', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
    };

    const schema = processSchema(schemaObj);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(
      new StringSchema().withContentMediaType('application/octet-stream')
    );
  });

  it('should set content encoding for base64 format', () => {
    const schemaObj: Draft202012SchemaObject = {
      type: 'string',
      contentEncoding: 'base64',
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(new StringSchema().withContentEncoding('base64'));
  });

  // waiting for https://github.com/scalar/scalar/pull/5274 to land
  it.skip('should set content encoding for byte format', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'string',
      format: 'byte',
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(new StringSchema().withContentEncoding('base64'));
  });

  test.each(['pattern', 'maxLength', 'minLength'])(
    'should create string json-schema for string specific keyword %s',
    (keyword) => {
      const schemaObj: OpenAPIV3.SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj as Draft202012SchemaObject);

      expect(schema).toBeInstanceOf(StringSchema);
    }
  );

  test.each([
    'multipleOf',
    'maximum',
    'minimum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ])(
    'should create number json-schema for number specific keyword %s',
    (keyword) => {
      const schemaObj: OpenAPIV3.SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj as Draft202012SchemaObject);

      expect(schema).toBeInstanceOf(NumberSchema);
    }
  );

  it('should create integer json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'integer',
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(IntegerSchema);
    expect(schema).toEqual(new IntegerSchema());
  });

  it('should create object json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        a: {
          type: 'string',
        },
        b: {
          type: 'boolean',
        },
      },
      additionalProperties: false,
      minProperties: 1,
      maxProperties: 3,
      required: ['a'],
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ObjectSchema);
    expect(schema).toEqual(
      new ObjectSchema()
        .withRequiredProperty('a', new StringSchema())
        .withProperty('b', new BooleanSchema())
        .withAdditionalProperties(false)
        .withMinProperties(1)
        .withMaxProperties(3)
    );
  });

  test.each([
    'properties',
    'required',
    'additionalProperties',
    'minProperties',
    'maxProperties',
  ])(
    'should create object json-schema for object specific keyword %s',
    (keyword) => {
      const schemaObj: OpenAPIV3.SchemaObject = {
        [keyword]: undefined,
      };

      const schema = processSchema(schemaObj as Draft202012SchemaObject);

      expect(schema).toBeInstanceOf(ObjectSchema);
    }
  );

  it('should create array json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'array',
      items: {
        type: 'string',
      },
      uniqueItems: true,
      maxItems: 20,
      minItems: 3,
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ArraySchema);
    expect(schema).toEqual(
      new ArraySchema()
        .withItems(new StringSchema())
        .withMaxItems(20)
        .withMinItems(3)
        .unique(true)
    );
  });

  test.each(['items', 'uniqueItems', 'maxItems', 'minItems'])(
    'should create array json-schema for array specific keyword %s',
    (keyword) => {
      const schemaObj: OpenAPIV3.SchemaObject = {
        [keyword]: {},
      };

      const schema = processSchema(schemaObj as Draft202012SchemaObject);

      expect(schema).toBeInstanceOf(ArraySchema);
    }
  );

  it('should set enum value', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      enum: ['constVal'],
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(new ThymianSchema().withEnum('constVal'));
  });

  it('should process oneOf correctly', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(
      new ThymianSchema().withOneOf([new StringSchema(), new NumberSchema()])
    );
  });

  it('should create multi type json-schema', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      minimum: 10,
      maximum: 20,
      minLength: 3,
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(MultiTypeSchema);
    expect(schema).toEqual(
      new MultiTypeSchema()
        .withSchema(new StringSchema().withMinLength(3))
        .withSchema(new NumberSchema().withMinimum(10).withMaximum(20))
        .withType('string', 'number')
    );
  });

  it('should process not correctly', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      not: {
        oneOf: [
          {
            type: 'array',
            items: {},
          },
          {
            type: 'object',
          },
        ],
      },
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ThymianSchema);
    expect(schema).toEqual(
      new ThymianSchema().withNot(
        new ThymianSchema().withOneOf([
          new ArraySchema().withItems(new EmptySchema()),
          new ObjectSchema(),
        ])
      )
    );
  });

  it('should process nested json-schema correctly', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      properties: {
        objProp: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                arr: {
                  type: 'array',
                  items: {
                    type: 'integer',
                    format: 'int32',
                  },
                  oneOf: [
                    {
                      maxItems: 20,
                      minItems: 10,
                    },
                    {
                      maxItems: 40,
                      minItems: 30,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(ObjectSchema);
    expect(schema).toEqual(
      new ObjectSchema().withProperty(
        'objProp',
        new ObjectSchema().withProperty(
          'nested',
          new ObjectSchema().withProperty(
            'arr',
            new ArraySchema()
              .withItems(new IntegerSchema().withFormat('int32'))
              .withOneOf([
                new ArraySchema().withMinItems(10).withMaxItems(20),
                new ArraySchema().withMinItems(30).withMaxItems(40),
              ])
          )
        )
      )
    );
  });

  it('should ignore keywords of other types', () => {
    const schemaObj: OpenAPIV3.SchemaObject = {
      type: 'string',
      minimum: 2,
      maxLength: 3,
    };

    const schema = processSchema(schemaObj as Draft202012SchemaObject);

    expect(schema).toBeInstanceOf(StringSchema);
    expect(schema).toEqual(new StringSchema().withMaxLength(3));
  });
});
