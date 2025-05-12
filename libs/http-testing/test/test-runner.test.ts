import { describe, it } from 'vitest';
import { StringSchema } from '@thymian/core';
import { SchemaDataGenerator } from '../src/visitor.js';

describe('TestRunner', () => {
  it('should ', () => {
    const schema = new StringSchema().withExample('test');

    let value;
    schema.accept(new SchemaDataGenerator(value));

    console.log(value);
  });
});
