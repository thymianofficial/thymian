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
          'id',
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
          'id',
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
          'id',
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
          'id',
          'role,admin,level,3',
          schema,
          style('simple', false),
        ),
      ),
    ).toEqual({ role: 'admin', level: 3 });

    expect(
      value(
        deserializePathParameter(
          'id',
          'role=admin,level=3',
          schema,
          style('simple', true),
        ),
      ),
    ).toEqual({ role: 'admin', level: 3 });
  });

  it.each(['form', 'deepObject'] as const)(
    'reports %s as unsupported for a structured path value',
    (name) => {
      // `label` and `matrix` are reversible now (gh-673); what remains
      // unsupported for a path is a style that is not a path style at all.
      // Scalars keep their validation regardless — only a structured value
      // genuinely cannot be reconstructed.
      expect(
        deserializePathParameter(
          'id',
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
          'id',
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
          'id',
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
          'id',
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
          'id',
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
          'id',
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
  it.each(['form', 'deepObject'] as const)(
    'still validates a string-typed path parameter under %s',
    (name) => {
      const result = deserializePathParameter(
        'id',
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
        'id',
        'role,admin',
        { type: 'object', properties: { role: { type: 'string' } } },
        style('form', true),
      ).supported,
    ).toBe(false);
  });

  it('hands a malformed label object to the schema rather than repairing it', () => {
    // `.role.admin` is not the exploded object form (`.role=admin`), so it is
    // malformed — reversible style, unreversible value.
    const result = deserializePathParameter(
      'id',
      '.role.admin',
      { type: 'object', properties: { role: { type: 'string' } } },
      style('label', true),
    );

    expect(result.supported).toBe(true);
    // Reported as the text the client sent (prefix stripped), not as the
    // items it was split into — the schema failure should name a real value.
    expect(value(result)).toBe('role.admin');
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

describe('label and matrix path styles (gh-673)', () => {
  const INT: ThymianSchema = { type: 'integer' };
  const ARR: ThymianSchema = { type: 'array', items: { type: 'integer' } };
  const OBJ: ThymianSchema = {
    type: 'object',
    properties: { role: { type: 'string' }, lvl: { type: 'integer' } },
  };

  // Wire forms below are what `url-template` actually emits for the templates
  // `serializePathParameter` builds — this suite is the inverse of that output.
  it.each([
    ['label scalar', '.5', INT, 'label', false, 5],
    ['label array, explode false', '.3,4,5', ARR, 'label', false, [3, 4, 5]],
    ['label array, explode true', '.3.4.5', ARR, 'label', true, [3, 4, 5]],
    ['matrix scalar', ';id=5', INT, 'matrix', false, 5],
    [
      'matrix array, explode false',
      ';id=3,4,5',
      ARR,
      'matrix',
      false,
      [3, 4, 5],
    ],
    [
      'matrix array, explode true',
      ';id=3;id=4;id=5',
      ARR,
      'matrix',
      true,
      [3, 4, 5],
    ],
  ] as const)('reverses %s', (_name, wire, schema, name, explode, expected) => {
    expect(
      value(deserializePathParameter('id', wire, schema, style(name, explode))),
    ).toEqual(expected);
  });

  it.each([
    ['.role,admin,lvl,3', 'label', false],
    ['.role=admin.lvl=3', 'label', true],
    [';id=role,admin,lvl,3', 'matrix', false],
    [';role=admin;lvl=3', 'matrix', true],
  ] as const)('reverses the object form %s', (wire, name, explode) => {
    expect(
      value(deserializePathParameter('id', wire, OBJ, style(name, explode))),
    ).toEqual({ role: 'admin', lvl: 3 });
  });

  it('strips the label prefix from a string-typed value', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          '.abc',
          { type: 'string' },
          style('label', false),
        ),
      ),
    ).toBe('abc');
  });

  it('still reports a violation, with the same message shape as simple', () => {
    const schema: ThymianSchema = { type: 'string', maxLength: 3 };

    expect(
      value(
        deserializePathParameter(
          'id',
          '.abcdef',
          schema,
          style('label', false),
        ),
      ),
    ).toBe('abcdef');
    expect(
      value(
        deserializePathParameter(
          'id',
          ';id=abcdef',
          schema,
          style('matrix', false),
        ),
      ),
    ).toBe('abcdef');
  });

  it('splits before decoding, so an escaped delimiter stays one item', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          '.a%2Cb',
          { type: 'array', items: { type: 'string' } },
          style('label', false),
          decodeURIComponent,
        ),
      ),
    ).toEqual(['a,b']);
  });

  it.each([
    ['missing label prefix', '5', 'label', false],
    ['matrix name mismatch', ';other=5', 'matrix', false],
    ['matrix missing prefix', '5', 'matrix', false],
    ['matrix exploded name mismatch', ';other=3;other=4', 'matrix', true],
    ['matrix exploded missing ";"', 'id=3;id=4', 'matrix', true],
    ['matrix absorbing a neighbour', ';id=3;other=4', 'matrix', false],
  ] as const)(
    'reports %s as a description violation, not a silent pass',
    (_n, wire, name, explode) => {
      // A style thymian CAN reverse, carrying a value that is not in it, is
      // the request's defect — it must not be handed to a permissive schema
      // that would accept the packaging as a plain string.
      const result = deserializePathParameter(
        'id',
        wire,
        { type: 'array', items: { type: 'integer' } },
        style(name, explode),
      );

      expect(result.supported).toBe(false);
      expect(result.supported === false && result.malformed).toBe(true);
    },
  );

  it('reports a duplicated property in the exploded object form', () => {
    const result = deserializePathParameter(
      'id',
      ';role=a;role=b',
      { type: 'object', properties: { role: { type: 'string' } } },
      style('matrix', true),
    );

    expect(result.supported).toBe(false);
    expect(result.supported === false && result.malformed).toBe(true);
  });

  it('reads the RFC 6570 empty matrix form, which omits the "="', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          ';id',
          { type: 'string' },
          style('matrix', false),
        ),
      ),
    ).toBe('');
  });

  it('treats an empty body after a present prefix as one empty member', () => {
    const arr: ThymianSchema = { type: 'array', items: { type: 'string' } };

    expect(
      value(deserializePathParameter('id', '.', arr, style('label', false))),
    ).toEqual(['']);
    expect(
      value(deserializePathParameter('id', ';id=', arr, style('matrix', true))),
    ).toEqual(['']);
  });

  it('does not split a scalar on a delimiter it legitimately contains', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          '.1.5',
          { type: 'number' },
          style('label', true),
        ),
      ),
    ).toBe(1.5);
  });

  it('resolves an array|object union the same way the typing step does', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          ';id=3;id=4',
          { type: ['array', 'object'], items: { type: 'integer' } },
          style('matrix', true),
        ),
      ),
    ).toEqual([3, 4]);
  });

  it('leaves the simple style untouched', () => {
    expect(
      value(deserializePathParameter('id', '42', INT, style('simple', false))),
    ).toBe(42);
  });
});

describe('structural shape without a literal `type` (gh-673 review)', () => {
  // `{ properties: {...} }` and `{ items: {...} }` are unambiguously structured
  // even with no `type` keyword — extremely common in real OpenAPI documents.
  // Treating them as scalars meant the value was never split and
  // properties/items never applied, so violations passed clean.
  const OBJ_NO_TYPE: ThymianSchema = {
    properties: { role: { type: 'string' }, lvl: { type: 'integer' } },
  };
  const ARR_NO_TYPE: ThymianSchema = { items: { type: 'integer' } };

  it('builds an object from a properties-only schema', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          ';role=admin;lvl=3',
          OBJ_NO_TYPE,
          style('matrix', true),
        ),
      ),
    ).toEqual({ role: 'admin', lvl: 3 });
  });

  it('builds an array from an items-only schema', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          ';id=3;id=4',
          ARR_NO_TYPE,
          style('matrix', true),
        ),
      ),
    ).toEqual([3, 4]);
  });

  it('applies to the simple style too, where the gap predated gh-673', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          'role,admin,lvl,3',
          OBJ_NO_TYPE,
          style('simple', false),
        ),
      ),
    ).toEqual({ role: 'admin', lvl: 3 });
  });

  it('still treats a declared scalar type as a scalar', () => {
    expect(
      value(
        deserializePathParameter(
          'id',
          'a,b',
          { type: 'string', maxLength: 3 },
          style('simple', false),
        ),
      ),
    ).toBe('a,b');
  });
});

describe('explode mismatch is not repaired (gh-673 review)', () => {
  it('refuses to pair up an exploded object sent as non-exploded', () => {
    // `.role=admin,lvl=3` under explode:false would otherwise become the
    // property `"role=admin"` and validate against a permissive schema.
    expect(
      value(
        deserializePathParameter(
          'id',
          '.role=admin,lvl=3',
          { type: 'object', properties: { role: { type: 'string' } } },
          style('label', false),
        ),
      ),
    ).toBe('role=admin,lvl=3');
  });
});
