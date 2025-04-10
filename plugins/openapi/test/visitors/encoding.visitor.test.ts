import { describe, it, expect } from 'vitest';
import {
  ArraySchema,
  BooleanSchema,
  IntegerSchema,
  MultiTypeSchema,
  NullSchema,
  NumberSchema,
  ObjectSchema,
  StringSchema,
} from '@thymian/core';
import { EncodingVisitor } from '../../src/visitors/encoding.visitor.js';

describe('EncodingVisitor', () => {
  it('should set encoding to property', () => {
    const strSchema = new StringSchema();
    const schema = new MultiTypeSchema()
      .withSchema(
        new ObjectSchema()
          .withProperty('a', new NumberSchema())
          .withProperty('b', strSchema)
          .withProperty('c', new ArraySchema().withItems(new BooleanSchema()))
          .withProperty('d', new IntegerSchema())
          .withProperty('e', new NullSchema())
      )
      .withOneOf([new StringSchema(), new IntegerSchema()]);

    schema.accept(
      new EncodingVisitor({
        b: {
          contentType: 'application/octet-stream',
        },
      })
    );

    expect(strSchema.contentMediaType).toEqual('application/octet-stream');
  });

  it('should set encoding to deep nested property', () => {
    const strSchema = new StringSchema();
    const schema = new MultiTypeSchema()
      .withSchema(
        new ObjectSchema()
          .withProperty('a', new NumberSchema())
          .withProperty('c', new ArraySchema().withItems(new BooleanSchema()))
          .withProperty('d', new IntegerSchema())
          .withProperty('e', new NullSchema())
      )
      .withOneOf([
        new StringSchema(),
        new IntegerSchema(),
        new ObjectSchema().withRequiredProperty(
          'nested',
          new ObjectSchema().withProperty(
            'deepNested',
            new ObjectSchema().withProperty(
              'evenDeeper',
              new ObjectSchema().withProperty('b', strSchema)
            )
          )
        ),
      ]);

    schema.accept(
      new EncodingVisitor({
        b: {
          contentType: 'image/png',
        },
      })
    );

    expect(strSchema.contentMediaType).toEqual('image/png');
  });

  it('should detect array content type', () => {
    const schema = new ArraySchema().withItems(new ObjectSchema());

    schema.accept(new EncodingVisitor({}));

    expect(schema.contentMediaType).toEqual('application/json');
  });
});
