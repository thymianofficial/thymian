import type { JSONSchemaType } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import { ajv, formatAjvErrors } from '../src/ajv.js';

type Person = {
  name: string;
  age: number;
};

const personSchema: JSONSchemaType<Person> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 },
  },
  required: ['name', 'age'],
  additionalProperties: false,
};

describe('formatAjvErrors', () => {
  it('produces readable messages for a multi-property failure', () => {
    const valid = ajv.validate(personSchema, { age: -1, extra: true });

    expect(valid).toBe(false);

    const { message, details } = formatAjvErrors(ajv.errors);

    // allErrors:true means every failing constraint is collected, not just
    // the first, so we get a detail per violated property.
    expect(details.length).toBeGreaterThan(1);
    expect(message.length).toBeGreaterThan(0);

    // The combined message and the per-error details are human-readable and
    // reference the offending fields.
    const combined = [message, ...details].join('\n');
    expect(combined).toContain('name');
    expect(combined).toContain('age');
    expect(message).toContain(details[0]!);
  });

  it('returns a safe fallback for null errors', () => {
    expect(formatAjvErrors(null)).toEqual({
      message: 'Unknown validation error',
      details: [],
    });
  });

  it('returns a safe fallback for an empty errors array', () => {
    expect(formatAjvErrors([])).toEqual({
      message: 'Unknown validation error',
      details: [],
    });
  });

  it('never throws and stays informative when the library cannot render the errors', () => {
    // `@segment/ajv-human-errors` throws for `additionalProperties: false`
    // schemas that omit `properties` (and for `patternProperties`). The helper
    // must fall back to Ajv's own text rather than propagate a TypeError.
    const openSchema = {
      type: 'object',
      additionalProperties: false,
    } as unknown as JSONSchemaType<Record<string, never>>;

    const valid = ajv.validate(openSchema, { unexpected: 1 });
    expect(valid).toBe(false);

    let result!: ReturnType<typeof formatAjvErrors>;
    expect(() => {
      result = formatAjvErrors(ajv.errors);
    }).not.toThrow();

    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message).not.toBe('Unknown validation error');
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('caps a very large error list and reports the overflow', () => {
    const properties: Record<string, { type: 'string' }> = {};
    const data: Record<string, number> = {};
    // 30 string properties, each fed a number → 30 type violations.
    for (let i = 0; i < 30; i++) {
      properties[`field${i}`] = { type: 'string' };
      data[`field${i}`] = i;
    }
    const schema = {
      type: 'object',
      properties,
      required: Object.keys(properties),
    } as unknown as JSONSchemaType<Record<string, string>>;

    const valid = ajv.validate(schema, data);
    expect(valid).toBe(false);

    const { details } = formatAjvErrors(ajv.errors);

    // 20 detail lines + 1 overflow summary line.
    expect(details.length).toBe(21);
    expect(details.at(-1)).toContain('more validation error');
  });
});
