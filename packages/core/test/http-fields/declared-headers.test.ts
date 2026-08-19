import { describe, expect, it } from 'vitest';

import { DEFAULT_HEADER_SERIALIZATION_STYLE } from '../../src/constants.js';
import { fromDeclaredHeaders } from '../../src/http-fields/declared-headers.js';
import type { Parameter } from '../../src/index.js';

function headerParameter(overrides: Partial<Parameter> = {}): Parameter {
  return {
    required: false,
    schema: { type: 'string' },
    style: DEFAULT_HEADER_SERIALIZATION_STYLE,
    ...overrides,
  };
}

describe('fromDeclaredHeaders', () => {
  it('exposes the const pin kind and its value for a schema.const pin', () => {
    const declared = fromDeclaredHeaders({
      'Set-Cookie': headerParameter({
        required: true,
        schema: { const: 'id=1; SameSite=None' },
      }),
    });

    expect(declared('Set-Cookie')).toEqual({
      present: true,
      required: true,
      pin: { kind: 'const', value: 'id=1; SameSite=None' },
    });
  });

  it('looks up the pin case-insensitively', () => {
    const declared = fromDeclaredHeaders({
      'Set-Cookie': headerParameter({
        schema: { const: 'id=1; SameSite=None' },
      }),
    });

    expect(declared('set-cookie')).toEqual({
      present: true,
      required: false,
      pin: { kind: 'const', value: 'id=1; SameSite=None' },
    });
  });

  it('exposes only presence and required for a loose schema, no pin', () => {
    const declared = fromDeclaredHeaders({
      'X-Request-Id': headerParameter({
        required: true,
        schema: { type: 'string' },
      }),
    });

    const facts = declared('X-Request-Id');

    expect(facts).toEqual({ present: true, required: true });
    expect(facts.pin).toBeUndefined();
  });

  it('reports present: false for a header name absent from the record', () => {
    const declared = fromDeclaredHeaders({});

    expect(declared('X-Not-Declared')).toEqual({
      present: false,
      required: false,
    });
  });

  it('derives the enum pin kind', () => {
    const declared = fromDeclaredHeaders({
      Accept: headerParameter({ schema: { enum: ['a', 'b'] } }),
    });

    expect(declared('Accept').pin).toEqual({ kind: 'enum', value: ['a', 'b'] });
  });

  it('derives the pattern pin kind', () => {
    const declared = fromDeclaredHeaders({
      'X-Trace-Id': headerParameter({ schema: { pattern: '^[0-9a-f]+$' } }),
    });

    expect(declared('X-Trace-Id').pin).toEqual({
      kind: 'pattern',
      value: '^[0-9a-f]+$',
    });
  });

  it('derives the default pin kind', () => {
    const declared = fromDeclaredHeaders({
      'X-Api-Version': headerParameter({ schema: { default: '2026-01-01' } }),
    });

    expect(declared('X-Api-Version').pin).toEqual({
      kind: 'default',
      value: '2026-01-01',
    });
  });

  it('prefers const over enum/pattern/default when a schema pins more than one', () => {
    const declared = fromDeclaredHeaders({
      'X-Multi-Pin': headerParameter({
        schema: {
          const: 'pinned',
          enum: ['pinned', 'other'],
          pattern: '^pinned$',
          default: 'pinned',
        },
      }),
    });

    expect(declared('X-Multi-Pin').pin).toEqual({
      kind: 'const',
      value: 'pinned',
    });
  });

  it('does not let a mutated enum pin value corrupt the caller schema', () => {
    const schema = { enum: ['a', 'b'] };
    const declared = fromDeclaredHeaders({
      Accept: headerParameter({ schema }),
    });

    const facts = declared('Accept');
    (facts.pin?.value as string[]).push('INJECTED');

    expect(schema.enum).toEqual(['a', 'b']);
  });

  it('takes the first case-variant declared key when the same header name is declared twice', () => {
    const declared = fromDeclaredHeaders({
      'Set-Cookie': headerParameter({
        required: true,
        schema: { const: 'first' },
      }),
      'set-cookie': headerParameter({
        required: false,
        schema: { const: 'second' },
      }),
    });

    expect(declared('Set-Cookie')).toEqual({
      present: true,
      required: true,
      pin: { kind: 'const', value: 'first' },
    });
  });
});
