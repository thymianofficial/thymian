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
      pins: [{ kind: 'const', value: 'id=1; SameSite=None' }],
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
      pins: [{ kind: 'const', value: 'id=1; SameSite=None' }],
    });
  });

  it('exposes only presence and required for a loose schema, with no pins', () => {
    const declared = fromDeclaredHeaders({
      'X-Request-Id': headerParameter({
        required: true,
        schema: { type: 'string' },
      }),
    });

    const facts = declared('X-Request-Id');

    expect(facts).toEqual({ present: true, required: true, pins: [] });
  });

  it('reports present: false for a header name absent from the record', () => {
    const declared = fromDeclaredHeaders({});

    expect(declared('X-Not-Declared')).toEqual({
      present: false,
      required: false,
      pins: [],
    });
  });

  it('derives the enum pin kind', () => {
    const declared = fromDeclaredHeaders({
      Accept: headerParameter({ schema: { enum: ['a', 'b'] } }),
    });

    expect(declared('Accept').pins).toEqual([
      { kind: 'enum', value: ['a', 'b'] },
    ]);
  });

  it('derives the pattern pin kind', () => {
    const declared = fromDeclaredHeaders({
      'X-Trace-Id': headerParameter({ schema: { pattern: '^[0-9a-f]+$' } }),
    });

    expect(declared('X-Trace-Id').pins).toEqual([
      { kind: 'pattern', value: '^[0-9a-f]+$' },
    ]);
  });

  it('derives the default pin kind', () => {
    const declared = fromDeclaredHeaders({
      'X-Api-Version': headerParameter({ schema: { default: '2026-01-01' } }),
    });

    expect(declared('X-Api-Version').pins).toEqual([
      { kind: 'default', value: '2026-01-01' },
    ]);
  });

  it('reports both pins of a pattern+default schema, keeping the value reachable', () => {
    const declared = fromDeclaredHeaders({
      'X-Api-Version': headerParameter({
        schema: { pattern: '^v\\d+$', default: 'v1' },
      }),
    });

    // The whole point of reporting every pin: a single precedence slot ranking
    // `pattern` above `default` would surrender 'v1', the only value this
    // schema declares.
    expect(declared('X-Api-Version').pins).toEqual([
      { kind: 'default', value: 'v1' },
      { kind: 'pattern', value: '^v\\d+$' },
    ]);
  });

  it('reports both pins of an enum+default schema', () => {
    const declared = fromDeclaredHeaders({
      'X-Mode': headerParameter({
        schema: { enum: ['strict', 'lax'], default: 'lax' },
      }),
    });

    expect(declared('X-Mode').pins).toEqual([
      { kind: 'enum', value: ['strict', 'lax'] },
      { kind: 'default', value: 'lax' },
    ]);
  });

  it('reports all four pins in const > enum > default > pattern order', () => {
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

    expect(declared('X-Multi-Pin').pins).toEqual([
      { kind: 'const', value: 'pinned' },
      { kind: 'enum', value: ['pinned', 'other'] },
      { kind: 'default', value: 'pinned' },
      { kind: 'pattern', value: '^pinned$' },
    ]);
  });

  it('does not let a mutated enum pin value corrupt the caller schema', () => {
    const schema = { enum: ['a', 'b'] };
    const declared = fromDeclaredHeaders({
      Accept: headerParameter({ schema }),
    });

    const pin = declared('Accept').pins[0];
    (pin?.value as string[]).push('INJECTED');

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
      pins: [{ kind: 'const', value: 'first' }],
    });
  });
});
