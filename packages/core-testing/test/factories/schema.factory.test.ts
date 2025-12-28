import { describe, expect, it } from 'vitest';

import {
  createArraySchema,
  createBooleanSchema,
  createIntegerSchema,
  createNumberSchema,
  createObjectSchema,
  createStringSchema,
  createThymianSchema,
} from '../../src/factories/schema.factory.js';

describe('Schema Factory', () => {
  describe('createThymianSchema', () => {
    it('should create a schema with default type string', () => {
      const schema = createThymianSchema();
      expect(schema.type).toBe('string');
    });

    it('should allow overriding properties', () => {
      const schema = createThymianSchema({
        type: 'number',
        minimum: 0,
        maximum: 100,
      });
      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
    });
  });

  describe('createStringSchema', () => {
    it('should create a string schema', () => {
      const schema = createStringSchema();
      expect(schema.type).toBe('string');
    });

    it('should allow string-specific properties', () => {
      const schema = createStringSchema({
        minLength: 5,
        maxLength: 50,
        pattern: '^[a-z]+$',
      });
      expect(schema.type).toBe('string');
      expect(schema.minLength).toBe(5);
      expect(schema.maxLength).toBe(50);
      expect(schema.pattern).toBe('^[a-z]+$');
    });
  });

  describe('createNumberSchema', () => {
    it('should create a number schema', () => {
      const schema = createNumberSchema();
      expect(schema.type).toBe('number');
    });

    it('should allow number-specific properties', () => {
      const schema = createNumberSchema({
        minimum: 0,
        maximum: 100,
        multipleOf: 5,
      });
      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
      expect(schema.multipleOf).toBe(5);
    });
  });

  describe('createIntegerSchema', () => {
    it('should create an integer schema', () => {
      const schema = createIntegerSchema();
      expect(schema.type).toBe('integer');
    });
  });

  describe('createBooleanSchema', () => {
    it('should create a boolean schema', () => {
      const schema = createBooleanSchema();
      expect(schema.type).toBe('boolean');
    });
  });

  describe('createObjectSchema', () => {
    it('should create an object schema with empty properties', () => {
      const schema = createObjectSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toEqual({});
    });

    it('should create an object schema with properties', () => {
      const schema = createObjectSchema({
        name: createStringSchema(),
        age: createIntegerSchema(),
      });
      expect(schema.type).toBe('object');
      expect(schema.properties?.name).toBeDefined();
      expect(schema.properties?.age).toBeDefined();
    });

    it('should allow additional overrides', () => {
      const schema = createObjectSchema(
        { name: createStringSchema() },
        { required: ['name'], minProperties: 1 },
      );
      expect(schema.required).toEqual(['name']);
      expect(schema.minProperties).toBe(1);
    });
  });

  describe('createArraySchema', () => {
    it('should create an array schema with string items by default', () => {
      const schema = createArraySchema();
      expect(schema.type).toBe('array');
      expect(schema.items).toBeDefined();
      expect(schema.items?.type).toBe('string');
    });

    it('should create an array schema with custom items', () => {
      const schema = createArraySchema(createIntegerSchema());
      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('integer');
    });

    it('should allow array-specific properties', () => {
      const schema = createArraySchema(createStringSchema(), {
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
      });
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(10);
      expect(schema.uniqueItems).toBe(true);
    });
  });
});
