import type { ErrorObject } from 'ajv';
import { describe, expect, it } from 'vitest';

import {
  describeSchemaError,
  schemaErrorDetail,
} from '../../../src/http-testing/validate/schema-error.js';

function error(overrides: Partial<ErrorObject>): ErrorObject {
  return {
    keyword: 'type',
    instancePath: '',
    schemaPath: '',
    params: {},
    ...overrides,
  } as ErrorObject;
}

describe('describeSchemaError', () => {
  it('names the property path for a nested value error', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'type',
          instancePath: '/user/age',
          message: 'must be integer',
        }),
      ),
    ).toBe('property "user.age" must be integer');
  });

  it('renders array indices in the property path', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'type',
          instancePath: '/items/2/id',
          message: 'must be integer',
        }),
      ),
    ).toBe('property "items[2].id" must be integer');
  });

  it('resolves a required error to the missing property path', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'required',
          instancePath: '/user',
          params: { missingProperty: 'name' },
          message: "must have required property 'name'",
        }),
      ),
    ).toBe('property "user.name" is required');
  });

  it('resolves a required error at the root', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'required',
          instancePath: '',
          params: { missingProperty: 'email' },
        }),
      ),
    ).toBe('property "email" is required');
  });

  it('falls back to the subject when there is no property path', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'pattern',
          instancePath: '',
          message: 'must match pattern "^[0-9]+$"',
        }),
        'header "x-count"',
      ),
    ).toBe('header "x-count" must match pattern "^[0-9]+$"');
  });

  it('uses the raw message when neither a path nor a subject is available', () => {
    expect(
      describeSchemaError(
        error({ instancePath: '', message: 'must be object' }),
      ),
    ).toBe('must be object');
  });

  it('names the offending key for an additionalProperties error', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'additionalProperties',
          instancePath: '/user',
          params: { additionalProperty: 'extra' },
          message: 'must NOT have additional properties',
        }),
      ),
    ).toBe('property "user.extra" is not allowed');
  });

  it('names a root-level additionalProperties key', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'additionalProperties',
          instancePath: '',
          params: { additionalProperty: 'extra' },
          message: 'must NOT have additional properties',
        }),
      ),
    ).toBe('property "extra" is not allowed');
  });

  it('names the offending key for an unevaluatedProperties error', () => {
    expect(
      describeSchemaError(
        error({
          keyword: 'unevaluatedProperties',
          instancePath: '/payload',
          params: { unevaluatedProperty: 'stray' },
          message: 'must NOT have unevaluated properties',
        }),
      ),
    ).toBe('property "payload.stray" is not allowed');
  });
});

describe('schemaErrorDetail', () => {
  it('returns the expected constraint and the actual value for a type error', () => {
    expect(
      schemaErrorDetail(
        error({
          keyword: 'type',
          params: { type: 'integer' },
          data: 'abc',
        }),
      ),
    ).toEqual({ expected: 'integer', actual: 'abc' });
  });

  it('returns the pattern constraint for a pattern error', () => {
    expect(
      schemaErrorDetail(
        error({
          keyword: 'pattern',
          params: { pattern: '^[0-9]+$' },
          data: 'ab',
        }),
      ),
    ).toEqual({ expected: '^[0-9]+$', actual: 'ab' });
  });

  it('returns nothing for a required error (no value was present)', () => {
    expect(
      schemaErrorDetail(
        error({ keyword: 'required', params: { missingProperty: 'name' } }),
      ),
    ).toEqual({});
  });

  it('returns nothing when the offending value is not a scalar', () => {
    expect(
      schemaErrorDetail(
        error({ keyword: 'type', params: { type: 'string' }, data: { a: 1 } }),
      ),
    ).toEqual({});
  });

  it('does not mislabel a maxLength bound as the expected value', () => {
    // ajv (verbose) sets params.limit=3 and error.schema=3 for `maxLength: 3`.
    // Pairing 3 as `expected` against actual "abcd" would be misleading; the
    // message already states the bound, so no pair is emitted.
    expect(
      schemaErrorDetail(
        error({
          keyword: 'maxLength',
          params: { limit: 3 },
          schema: 3,
          data: 'abcd',
        }),
      ),
    ).toEqual({});
  });

  it('does not mislabel a numeric maximum bound as the expected value', () => {
    expect(
      schemaErrorDetail(
        error({
          keyword: 'maximum',
          params: { comparison: '<=', limit: 10 },
          schema: 10,
          data: 15,
        }),
      ),
    ).toEqual({});
  });
});
