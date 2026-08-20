import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  DEFAULT_PATH_SERIALIZATION_STYLE,
  DEFAULT_QUERY_SERIALIZATION_STYLE,
} from '../../src/constants.js';
import type { SerializationStyle } from '../../src/format/serialization-style/index.js';
import type { ThymianSchema } from '../../src/format/thymian-schema.js';
import {
  deserializeHeaderParameter,
  deserializeObjectParameter,
  deserializePathParameter,
  deserializeQueryParameter,
  deserializeScalar,
  unsupportedStyleMessage,
} from '../../src/http-testing/deserialize-parameter.js';

const style = (
  name: SerializationStyle['style'],
  explode: boolean,
): SerializationStyle => ({ style: name, explode });

/** Unwrap a supported result, failing loudly when the style was rejected. */
function value(result: ReturnType<typeof deserializeQueryParameter>): unknown {
  if (!result.supported) {
    throw new Error(`expected a supported style, got "${result.style}"`);
  }

  return result.value;
}

describe('deserializeScalar', () => {
  it.each([
    ['2026', { type: 'integer' }, 2026],
    ['-7', { type: 'integer' }, -7],
    ['0', { type: 'integer' }, 0],
    ['1.5', { type: 'number' }, 1.5],
    ['true', { type: 'boolean' }, true],
    ['false', { type: 'boolean' }, false],
    ['true', { type: ['boolean', 'null'] }, true],
  ])('converts %j against %j', (wire, schema, expected) => {
    expect(deserializeScalar(wire, schema as ThymianSchema)).toBe(expected);
  });

  it.each([
    // Not a lexical integer — must survive untouched so the schema error fires.
    ['abc', { type: 'integer' }],
    ['', { type: 'integer' }],
    [' 12 ', { type: 'integer' }],
    ['0x10', { type: 'integer' }],
    ['Infinity', { type: 'number' }],
    ['1.5', { type: 'integer' }],
    // Non-JSON numeric forms no conforming serializer emits.
    ['+5', { type: 'integer' }],
    ['007', { type: 'integer' }],
    ['.5', { type: 'number' }],
    ['1.', { type: 'number' }],
    // Overflow / underflow / precision loss must not manufacture a pass.
    ['1e999', { type: 'number' }],
    ['1e-999', { type: 'number' }],
    ['9007199254740993', { type: 'integer' }],
    // An empty value is an empty string, not JSON null.
    ['', { type: ['boolean', 'null'] }],
    // Only lowercase literals are booleans in OpenAPI.
    ['TRUE', { type: 'boolean' }],
    ['1', { type: 'boolean' }],
  ])('leaves %j unchanged against %j', (wire, schema) => {
    expect(deserializeScalar(wire, schema as ThymianSchema)).toBe(wire);
  });

  it('never converts away from a declared string type', () => {
    expect(deserializeScalar('2026', { type: 'string' })).toBe('2026');
    expect(deserializeScalar('2026', { type: ['string', 'integer'] })).toBe(
      '2026',
    );
  });

  it('leaves the value alone when the schema declares no type', () => {
    expect(deserializeScalar('2026', undefined)).toBe('2026');
    expect(deserializeScalar('2026', {})).toBe('2026');
  });
});

describe('deserializeQueryParameter', () => {
  const integerSchema: ThymianSchema = { type: 'integer' };
  const integerArraySchema: ThymianSchema = {
    type: 'array',
    items: { type: 'integer' },
  };

  it('deserializes a scalar under the default query style', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['2026'],
          integerSchema,
          DEFAULT_QUERY_SERIALIZATION_STYLE,
        ),
      ),
    ).toBe(2026);
  });

  it('deserializes a repeated key as an array when explode is true', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['1', '2'],
          integerArraySchema,
          style('form', true),
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('deserializes a single occurrence as a one-element array', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['1'],
          integerArraySchema,
          style('form', true),
        ),
      ),
    ).toEqual([1]);
  });

  it('types a pre-split non-exploded array (the caller splits on the raw form)', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['1', '2'],
          integerArraySchema,
          style('form', false),
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('hands a polluted scalar to the schema instead of dropping occurrences', () => {
    // ?year=2026&year=9999 — a real client defect that must stay reported.
    expect(
      value(
        deserializeQueryParameter(
          ['2026', '9999'],
          integerSchema,
          style('form', true),
        ),
      ),
    ).toEqual(['2026', '9999']);
  });

  it('keeps a malformed array item as a string so the schema error fires', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['1', 'abc'],
          integerArraySchema,
          style('form', true),
        ),
      ),
    ).toEqual([1, 'abc']);
  });

  it.each(['spaceDelimited', 'pipeDelimited'] as const)(
    'reports %s as unsupported rather than validating it wrongly',
    (name) => {
      const result = deserializeQueryParameter(
        ['1|2'],
        integerArraySchema,
        style(name, true),
      );

      expect(result.supported).toBe(false);
    },
  );
});

describe('deserializeObjectParameter', () => {
  const filterSchema: ThymianSchema = {
    type: 'object',
    properties: { customers_id: { type: 'integer' }, name: { type: 'string' } },
  };

  it('rebuilds the object and deserializes each property against its schema', () => {
    const result = deserializeObjectParameter(
      [
        ['customers_id', '4382930'],
        ['name', 'acme'],
      ],
      filterSchema,
      style('deepObject', true),
    );

    expect(value(result)).toEqual({ customers_id: 4382930, name: 'acme' });
  });

  it('rejects deepObject without explode, which OpenAPI leaves undefined', () => {
    const result = deserializeObjectParameter(
      [['customers_id', '1']],
      filterSchema,
      style('deepObject', false),
    );

    expect(result.supported).toBe(false);
  });
});

describe('deserializePathParameter', () => {
  it('deserializes a scalar under the default path style', () => {
    expect(
      value(
        deserializePathParameter(
          '42',
          { type: 'integer' },
          DEFAULT_PATH_SERIALIZATION_STYLE,
        ),
      ),
    ).toBe(42);
  });

  it('splits a simple-style array on commas', () => {
    expect(
      value(
        deserializePathParameter(
          '3,4,5',
          { type: 'array', items: { type: 'integer' } },
          style('simple', false),
        ),
      ),
    ).toEqual([3, 4, 5]);
  });

  it('splits before decoding, so an escaped delimiter stays one item', () => {
    expect(
      value(
        deserializePathParameter(
          'a%2Cb',
          { type: 'array', items: { type: 'string' } },
          style('simple', false),
          decodeURIComponent,
        ),
      ),
    ).toEqual(['a,b']);
  });

  it('rebuilds a simple-style object for both explode forms', () => {
    const schema: ThymianSchema = {
      type: 'object',
      properties: { role: { type: 'string' }, level: { type: 'integer' } },
    };

    expect(
      value(
        deserializePathParameter(
          'role,admin,level,3',
          schema,
          style('simple', false),
        ),
      ),
    ).toEqual({ role: 'admin', level: 3 });

    expect(
      value(
        deserializePathParameter(
          'role=admin,level=3',
          schema,
          style('simple', true),
        ),
      ),
    ).toEqual({ role: 'admin', level: 3 });
  });

  it.each(['label', 'matrix'] as const)(
    'reports %s as unsupported for a structured value',
    (name) => {
      // Scalars under an unsupported style keep their validation; only a
      // structured value genuinely cannot be reconstructed.
      expect(
        deserializePathParameter(
          '3,4,5',
          { type: 'array', items: { type: 'integer' } },
          style(name, false),
        ).supported,
      ).toBe(false);
    },
  );
});

describe('deserializeHeaderParameter', () => {
  it('deserializes a scalar header', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-count',
          '5',
          { type: 'integer' },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toBe(5);
  });

  it('treats a repeated header as one comma-joined field value', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-ids',
          ['1', '2'],
          { type: 'array', items: { type: 'integer' } },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('passes an absent header through untouched', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-count',
          undefined,
          { type: 'integer' },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toBeUndefined();
  });
});

describe('unsupportedStyleMessage', () => {
  it('names the parameter, the style, and that nothing was validated', () => {
    const message = unsupportedStyleMessage('Query parameter "filter"', {
      supported: false,
      style: 'pipeDelimited',
      explode: true,
    });

    expect(message).toContain('Query parameter "filter"');
    expect(message).toContain('pipeDelimited');
    expect(message).toContain('not validated');
  });
});

describe('schema resolution (review round 1)', () => {
  // plugin-openapi localizes $ref into the parameter schema's own $defs rather
  // than inlining it, so this is the NORMAL shape of a reused parameter schema.
  const refSchema: ThymianSchema = {
    $ref: '#/$defs/Year',
    $defs: { Year: { type: 'integer', minimum: 1910 } },
  };

  it('resolves $ref through $defs before typing', () => {
    expect(deserializeScalar('2026', refSchema)).toBe(2026);
  });

  it('resolves an allOf-wrapped type', () => {
    expect(deserializeScalar('2026', { allOf: [{ type: 'integer' }] })).toBe(
      2026,
    );
  });

  it('infers the type of an enum-only schema', () => {
    expect(deserializeScalar('10', { enum: [10, 20, 50] })).toBe(10);
    expect(deserializeScalar('a', { enum: ['a', 'b'] })).toBe('a');
  });

  it('infers the type of a const-only schema', () => {
    expect(deserializeScalar('7', { const: 7 })).toBe(7);
  });

  it('unions the types of an anyOf', () => {
    expect(
      deserializeScalar('true', {
        anyOf: [{ type: 'boolean' }, { type: 'null' }],
      }),
    ).toBe(true);
  });

  it('survives a circular $ref instead of hanging', () => {
    expect(
      deserializeScalar('2026', {
        $ref: '#/$defs/A',
        $defs: { A: { $ref: '#/$defs/B' }, B: { $ref: '#/$defs/A' } },
      }),
    ).toBe('2026');
  });

  it('resolves $ref for array items', () => {
    expect(
      value(
        deserializeQueryParameter(
          ['1', '2'],
          {
            type: 'array',
            items: { $ref: '#/$defs/Id' },
            $defs: { Id: { type: 'integer' } },
          },
          style('form', true),
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('types deepObject properties through additionalProperties', () => {
    expect(
      value(
        deserializeObjectParameter(
          [['customers_id', '4382930']],
          { type: 'object', additionalProperties: { type: 'integer' } },
          style('deepObject', true),
        ),
      ),
    ).toEqual({ customers_id: 4382930 });
  });

  it('types array items through prefixItems', () => {
    expect(
      value(
        deserializePathParameter(
          '1,abc',
          {
            type: 'array',
            prefixItems: [{ type: 'integer' }, { type: 'string' }],
          },
          style('simple', false),
        ),
      ),
    ).toEqual([1, 'abc']);
  });
});

describe('header list folding (review round 1)', () => {
  const stringArray: ThymianSchema = {
    type: 'array',
    items: { type: 'string' },
  };

  it('trims the optional whitespace RFC 9110 permits in a list', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-ids',
          '1, 2',
          { type: 'array', items: { type: 'integer' } },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('never splits a string-typed header on a comma it legitimately contains', () => {
    const date = 'Mon, 02 Jan 2026 15:04:05 GMT';

    expect(
      value(
        deserializeHeaderParameter(
          'last-modified',
          date,
          { type: 'string' },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toBe(date);
  });

  it('exempts set-cookie from list folding (RFC 9110 §5.3)', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'set-cookie',
          ['a=1; Expires=Tue, 19 Aug 2026 00:00:00 GMT', 'b=2'],
          stringArray,
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toEqual(['a=1; Expires=Tue, 19 Aug 2026 00:00:00 GMT', 'b=2']);
  });

  it('hands a duplicated single-valued header to the schema', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'location',
          ['/a', '/b'],
          { type: 'string' },
          DEFAULT_HEADER_SERIALIZATION_STYLE,
        ),
      ),
    ).toEqual(['/a', '/b']);
  });
});

describe('malformed object forms (review round 1)', () => {
  const schema: ThymianSchema = {
    type: 'object',
    properties: { role: { type: 'string' }, level: { type: 'integer' } },
  };

  it('hands a dangling-key simple object to the schema rather than repairing it', () => {
    expect(
      value(
        deserializePathParameter(
          'role,admin,level',
          schema,
          style('simple', false),
        ),
      ),
    ).toBe('role,admin,level');
  });
});

describe('schema resolution (review round 2)', () => {
  it('keeps sibling keywords when following a $ref', () => {
    expect(
      deserializeScalar('5', {
        $ref: '#/$defs/P',
        type: 'integer',
        $defs: { P: { minimum: 1 } },
      }),
    ).toBe(5);
  });

  it('resolves a pointer that indexes an array-valued keyword', () => {
    expect(
      deserializeScalar('5', {
        $ref: '#/$defs/T/oneOf/0',
        $defs: { T: { oneOf: [{ type: 'integer' }] } },
      }),
    ).toBe(5);
  });

  it('rebases the root on a subschema carrying its own $defs', () => {
    expect(
      deserializeScalar('5', {
        allOf: [{ $ref: '#/$defs/X', $defs: { X: { type: 'integer' } } }],
      }),
    ).toBe(5);
  });

  it('merges anyOf carried by an allOf member', () => {
    expect(
      deserializeScalar('true', {
        allOf: [{ anyOf: [{ type: 'boolean' }, { type: 'null' }] }],
      }),
    ).toBe(true);
  });

  it('resolves the whole-document pointer "#"', () => {
    expect(deserializeScalar('7', { $ref: '#', type: 'integer' })).toBe(7);
  });

  it('percent-decodes pointer tokens', () => {
    expect(
      deserializeScalar('7', {
        $ref: '#/$defs/My%20Def',
        $defs: { 'My Def': { type: 'integer' } },
      }),
    ).toBe(7);
  });

  it('intersects allOf types, so member order cannot change the result', () => {
    // Unsatisfiable, so nothing converts — but identically in both orders.
    expect(
      deserializeScalar('5', {
        allOf: [{ type: 'integer' }, { type: 'string' }],
      }),
    ).toBe('5');
    expect(
      deserializeScalar('5', {
        allOf: [{ type: 'string' }, { type: 'integer' }],
      }),
    ).toBe('5');
  });

  it('matches a mixed-type enum member by its wire form', () => {
    expect(deserializeScalar('10', { enum: ['auto', 10, 20] })).toBe(10);
    expect(deserializeScalar('auto', { enum: ['auto', 10, 20] })).toBe('auto');
  });

  it('gives prefixItems precedence over items at a prefix position', () => {
    expect(
      value(
        deserializePathParameter(
          '1,x',
          {
            type: 'array',
            prefixItems: [{ type: 'integer' }],
            items: { type: 'string' },
          },
          style('simple', false),
        ),
      ),
    ).toEqual([1, 'x']);
  });

  it('does not treat contains as a per-item schema', () => {
    expect(
      value(
        deserializePathParameter(
          '1,2',
          { type: 'array', contains: { type: 'integer' } },
          style('simple', false),
        ),
      ),
    ).toEqual(['1', '2']);
  });

  it('applies every matching patternProperties schema', () => {
    expect(
      value(
        deserializeObjectParameter(
          [['x_id', '5']],
          {
            type: 'object',
            patternProperties: {
              '^x': { type: 'integer' },
              _id$: { minimum: 1 },
            },
          },
          style('deepObject', true),
        ),
      ),
    ).toEqual({ x_id: 5 });
  });

  it('does not convert past the safe-integer range on the number branch', () => {
    expect(deserializeScalar('9007199254740993', { type: 'number' })).toBe(
      '9007199254740993',
    );
    expect(
      deserializeScalar('9007199254740993', { type: ['integer', 'number'] }),
    ).toBe('9007199254740993');
  });

  it('converts a zero written in exponent form', () => {
    expect(deserializeScalar('0e5', { type: 'number' })).toBe(0);
  });

  it('builds objects without invoking the __proto__ setter', () => {
    const result = value(
      deserializeObjectParameter(
        [
          ['__proto__', ['1', '2']],
          ['ok', '3'],
        ],
        { type: 'object', additionalProperties: { type: 'string' } },
        style('deepObject', true),
      ),
    ) as Record<string, unknown>;

    expect(Object.keys(result)).toEqual(['__proto__', 'ok']);
    expect(Array.isArray(Object.getPrototypeOf(result))).toBe(false);
  });

  it('refuses to repair an exploded object segment missing its "="', () => {
    expect(
      value(
        deserializePathParameter(
          'role=admin,level',
          { type: 'object', properties: { role: { type: 'string' } } },
          style('simple', true),
        ),
      ),
    ).toBe('role=admin,level');
  });

  it('tolerates a parameter built without a style', () => {
    expect(() =>
      deserializeHeaderParameter(
        'x-count',
        '5',
        { type: 'integer' },
        undefined,
      ),
    ).not.toThrow();
  });
});

describe('RFC 9110 list folding (review round 2)', () => {
  const stringArray: ThymianSchema = {
    type: 'array',
    items: { type: 'string' },
  };

  it('does not split on a comma inside a quoted-string', () => {
    expect(
      value(
        deserializeHeaderParameter('x-list', '"a, b",c', stringArray, {
          style: 'simple',
          explode: false,
        }),
      ),
    ).toEqual(['a, b', 'c']);
  });

  it('ignores empty list members (§5.6.1.2)', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-ids',
          '1,,2',
          { type: 'array', items: { type: 'integer' } },
          { style: 'simple', explode: false },
        ),
      ),
    ).toEqual([1, 2]);
  });

  it('re-splits each of several repeated field lines', () => {
    expect(
      value(
        deserializeHeaderParameter(
          'x-ids',
          ['1,2', '3'],
          { type: 'array', items: { type: 'integer' } },
          { style: 'simple', explode: false },
        ),
      ),
    ).toEqual([1, 2, 3]);
  });
});

describe('unsupported styles only forfeit STRUCTURED values', () => {
  // A style describes how a structured value was flattened onto the wire.
  // A scalar has no structure to restore, so an unsupported style must not
  // cost it the schema checks that never depended on the style.
  it.each(['label', 'matrix'] as const)(
    'still validates a string-typed path parameter under %s',
    (name) => {
      const result = deserializePathParameter(
        'abcdef',
        { type: 'string', maxLength: 3 },
        style(name, false),
      );

      expect(result.supported).toBe(true);
      expect(value(result)).toBe('abcdef');
    },
  );

  it.each(['spaceDelimited', 'pipeDelimited'] as const)(
    'still validates an integer-typed query parameter under %s',
    (name) => {
      const result = deserializeQueryParameter(
        ['2026'],
        { type: 'integer' },
        style(name, true),
      );

      expect(result.supported).toBe(true);
      expect(value(result)).toBe(2026);
    },
  );

  it('still reports an unsupported style for an ARRAY-typed parameter', () => {
    expect(
      deserializeQueryParameter(
        ['1|2'],
        { type: 'array', items: { type: 'integer' } },
        style('pipeDelimited', true),
      ).supported,
    ).toBe(false);
  });

  it('still reports an unsupported style for an OBJECT-typed parameter', () => {
    expect(
      deserializePathParameter(
        '.role.admin',
        { type: 'object', properties: { role: { type: 'string' } } },
        style('label', true),
      ).supported,
    ).toBe(false);
  });

  it('resolves the schema through $ref before deciding', () => {
    // The structural test must resolve too, or a $ref'd array silently
    // takes the scalar path.
    expect(
      deserializeQueryParameter(
        ['1|2'],
        {
          $ref: '#/$defs/Ids',
          $defs: { Ids: { type: 'array', items: { type: 'integer' } } },
        },
        style('pipeDelimited', true),
      ).supported,
    ).toBe(false);
  });
});
