import { readFile } from 'node:fs/promises';

import type { ThymianError } from '@thymian/core';
import { compile, type JSONSchema } from 'json-schema-to-typescript';
import { toSafeString } from 'json-schema-to-typescript/dist/src/utils.js';
import { describe, expect, it } from 'vitest';

import {
  DeclarationSet,
  identifierOf,
  splitDeclarations,
} from '../src/generation/types/declaration-set.js';
import {
  assertEmittedNamesWereIssued,
  permittedBases,
} from '../src/generation/types/emitted-names.js';
import {
  applyDefinitionNames,
  assignDefinitionNames,
  definitionIdentity,
  type DefinitionNameAssignment,
} from '../src/generation/types/schema-definitions.js';
import {
  assignUniqueNames,
  foldExtendsInPlace,
  NameRegistry,
  safeIdentifier,
  stripIdentityNoiseInPlace,
  stripNameKeywordsInPlace,
  stripTypeDirectivesInPlace,
} from '../src/generation/types/type-names.js';
import {
  convertDefsToDefinitions,
  generateTypeForSchema,
} from '../src/hooks/generate-request-types.js';

/**
 * Strings that cross a transformation boundary. Every one of them is reachable
 * from a real description: `req.path` values like `/v1beta/…` and `/oauth2token`
 * come straight out of `plugin-openapi`, `2fa` is an ordinary query-parameter
 * name, `400` is an ordinary `components/schemas` key, and a control character
 * reaches a header name because nothing in the selector grammar forbids it.
 */
const BOUNDARY_NAMES = [
  'PostV1betaUsersApplicationJson201RequestBody',
  'GetOauth2token200ResponseBody',
  'GetBase64data200ResponseBody',
  'GetS3bucket200ResponseBody',
  'QueryParam_2fa',
  '2fa',
  '400',
  '_400',
  'Pet_2',
  'pet-owner',
  'pet_owner',
  'x\rbad',
  'a b',
  '',
  '-',
  '$dollar',
  'ábc',
  'Foo__bar',
  '__proto__',
  'GetAB200ResponseBody',
] as const;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

describe('safeIdentifier', () => {
  /**
   * The whole point of the function. `json-schema-to-typescript` declares under
   * `toSafeString(name)` rather than under `name`, so the only property that
   * makes "the name we reference" and "the name it declares" one string is that
   * our output is a fixed point of its transform. Asserted against the
   * library's own implementation, so a version bump that changes the transform
   * fails here rather than in a generated file.
   */
  it('produces a fixed point of the library transform for every boundary name', () => {
    for (const value of BOUNDARY_NAMES) {
      const safe = safeIdentifier(value);

      expect(safe, value).toMatch(IDENTIFIER);
      expect(toSafeString(safe), value).toBe(safe);
    }
  });

  it('produces a fixed point for the suffixed forms the registry mints', () => {
    for (const value of BOUNDARY_NAMES) {
      for (const suffixed of [
        `${safeIdentifier(value)}_2`,
        `${safeIdentifier(value)}_10`,
        `${safeIdentifier(value)}Base`,
      ]) {
        expect(toSafeString(suffixed), suffixed).toBe(suffixed);
      }
    }
  });

  it('is idempotent', () => {
    for (const value of BOUNDARY_NAMES) {
      expect(safeIdentifier(safeIdentifier(value)), value).toBe(
        safeIdentifier(value),
      );
    }
  });

  it('re-cases exactly what the library would have re-cased', () => {
    expect(safeIdentifier('PostV1betaUsers')).toBe('PostV1BetaUsers');
    expect(safeIdentifier('QueryParam_2fa')).toBe('QueryParam_2Fa');
    expect(safeIdentifier('400')).toBe('_400');
    expect(safeIdentifier('pet-owner')).toBe('PetOwner');
    expect(safeIdentifier('pet.owner')).toBe('PetOwner');
    // The underscore is KEPT, unlike the library's own transform, which
    // collapses `_o` into `O`. Keeping it is what lets `QueryParam_Limit` and
    // the `_2` collision suffix survive their own sanitisation — and it makes
    // `pet_owner` a different identifier from `pet-owner` rather than a
    // collision, which is strictly fewer forced renames.
    expect(safeIdentifier('pet_owner')).toBe('Pet_Owner');
    expect(safeIdentifier('Pet_2')).toBe('Pet_2');
    expect(safeIdentifier('')).toBe('Schema');
  });
});

describe('generateTypeForSchema', () => {
  /**
   * The invariant the whole surface rests on, asserted against the real
   * compiler rather than against a model of it: whatever name goes in, the
   * declaration that comes out declares the identifier the call reports.
   */
  it('declares the identifier it returns, for every boundary name', async () => {
    for (const value of BOUNDARY_NAMES) {
      const generated = await generateTypeForSchema(
        { type: 'object', properties: { a: { type: 'string' } } },
        'application/json',
        value,
      );

      expect(generated.declarations, value).toHaveLength(1);
      expect(identifierOf(generated.declarations[0] ?? ''), value).toBe(
        generated.type,
      );
    }
  });

  /**
   * The same invariant against the half of the boundary sanitisation cannot
   * reach. `schema.title` and `schema.$id` outrank the name `compile()` is
   * handed (`parser.js:274`), so before the strip this call declared `Pet` —
   * or `Urn`, from a URI `$id` — and reported a name that named nothing.
   * `plugin-openapi` copies both keywords through verbatim, so this is what a
   * `components/schemas` entry with a `title` actually looks like here.
   */
  it('declares the identifier it returns even when the schema names itself', async () => {
    for (const self of [
      { title: 'Pet' },
      { $id: 'Pet' },
      { title: 'Pet', $id: 'Owner' },
      { $id: 'urn:example:pet' },
    ]) {
      const label = JSON.stringify(self);
      const generated = await generateTypeForSchema(
        { ...self, type: 'object', properties: { a: { type: 'string' } } },
        'application/json',
        'GetPets200ResponseBody',
      );

      expect(generated.type, label).toBe('GetPets200ResponseBody');
      expect(generated.declarations, label).toHaveLength(1);
      expect(identifierOf(generated.declarations[0] ?? ''), label).toBe(
        generated.type,
      );
    }
  });
});

/**
 * Every position THE LIBRARY PARSES a subschema in, each planted with every
 * keyword that can name a declaration, dictate a type, or be mistaken for
 * structure.
 *
 * This docblock used to read "every position `ThymianSchema` and
 * `plugin-openapi` can put a subschema in", which is the exact "a statement
 * about a type is not evidence about a value" error the round-2 fix corrected
 * everywhere except in its own lists — including in the fixture that guards
 * them. `ThymianSchema` declares no `extends`, no array-form `items` and no
 * `additionalItems`; the library parses all three (`parser.js:293-301` for
 * `extends`, `:190-200` for the `TUPLE` branch), and a `title` in any of them
 * declares an interface nothing reserved. What the type declares does not
 * decide; what the library parses does.
 *
 * `extends` is planted here too, but as a CONTROL: it is the one parsed position
 * the strip deliberately leaves alone, because a super-type with no name makes
 * the library emit `extends  {` and throw a raw prettier `SyntaxError` — see
 * `SUBSCHEMA_ARRAY_KEYWORDS`. Its hazard is covered by the postcondition
 * instead, which is asserted below.
 */
function schemaWithNameKeywordsEverywhere(): Record<string, unknown> {
  const named = (marker: string) => ({
    title: `Title_${marker}`,
    $id: `Id_${marker}`,
    id: `LegacyId_${marker}`,
    tsType: `TsType_${marker}`,
    tsEnumNames: [`TsEnumName_${marker}`],
    description: `Doc_${marker}`,
    type: 'object',
  });

  return {
    ...named('root'),
    // Array-form `items` rides along inside `properties`, so the single-schema
    // form at the root and the tuple form are both covered by one fixture.
    properties: {
      a: { ...named('properties'), items: [named('itemsTuple')] },
    },
    patternProperties: { '^x-': named('patternProperties') },
    dependentSchemas: { a: named('dependentSchemas') },
    $defs: {
      D: { ...named('defs'), $defs: { N: named('nestedDefs') } },
    },
    definitions: { L: named('definitions') },
    additionalItems: named('additionalItems'),
    additionalProperties: named('additionalProperties'),
    contains: named('contains'),
    else: named('else'),
    if: named('if'),
    items: named('items'),
    not: named('not'),
    propertyNames: named('propertyNames'),
    then: named('then'),
    unevaluatedItems: named('unevaluatedItems'),
    unevaluatedProperties: named('unevaluatedProperties'),
    allOf: [named('allOf')],
    anyOf: [named('anyOf')],
    extends: [named('extends')],
    oneOf: [named('oneOf')],
    prefixItems: [named('prefixItems')],
  };
}

/**
 * A schema whose keyword-looking members are DATA or PROPERTY NAMES, in every
 * position a blind walk would corrupt. All three strips share one walk, so all
 * three have to leave this untouched.
 */
function schemaWhereKeywordsAreNotKeywords(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      $id: { type: 'string' },
      id: { type: 'string' },
      description: { type: 'string' },
      tsType: { type: 'string' },
      tsEnumNames: { type: 'string' },
    },
    required: ['title', 'id', 'description'],
    examples: [{ title: 'Dune', $id: 'urn:x', id: 'b1', description: 'd' }],
    default: { title: 'none', id: 'none' },
    const: { title: 'fixed', tsType: 'not-a-directive' },
    enum: [{ title: 'one', id: 'two' }],
  };
}

/** The fixture minus the one position the strips deliberately do not enter. */
function withoutExtends(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const rest = { ...schema };

  delete rest['extends'];

  return rest;
}

const PROPERTY_KEYS = [
  'title',
  '$id',
  'id',
  'description',
  'tsType',
  'tsEnumNames',
];

describe('stripNameKeywordsInPlace', () => {
  it('removes title, $id and id from every subschema position', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripNameKeywordsInPlace(schema);

    expect(JSON.stringify(withoutExtends(schema))).not.toMatch(
      /"(title|\$id|id)":/,
    );
  });

  /**
   * The control, and it is about THIS pass only. Removing a super-type's name in
   * place would break a description that works — the library renders
   * `extends  {` and its own formatter throws. The hazard is closed one step
   * earlier instead, by {@link foldExtendsInPlace}, which moves the super-type
   * into `allOf` where this walk reaches it normally.
   */
  it('leaves a super-type its name, because an unnamed one cannot be emitted', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripNameKeywordsInPlace(schema);

    expect(JSON.stringify(schema['extends'])).toMatch(/"title":/);
  });

  /**
   * The two keywords it must NOT remove, and they are not symmetric with each
   * other. `description` is what the library turns into a JSDoc comment, which
   * AC8 requires. `tsType` is written by the generator's OWN example-reflection
   * pass before this boundary is reached, so stripping it here deletes AC6's
   * mechanism rather than the description's — measured: eight reflection tests
   * fail. The description's directives are removed one boundary earlier, by
   * {@link stripTypeDirectivesInPlace}.
   */
  it('keeps description and the type directives, which are not its job', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripNameKeywordsInPlace(schema);

    const text = JSON.stringify(schema);

    expect(text).toMatch(/"description":/);
    expect(text).toMatch(/"tsType":/);
    expect(text).toMatch(/"tsEnumNames":/);
  });

  it('leaves the keywords alone where they are not keywords', () => {
    const schema = schemaWhereKeywordsAreNotKeywords();
    const untouched = structuredClone(schema);

    stripNameKeywordsInPlace(schema);

    expect(schema).toEqual(untouched);
  });

  it('tolerates the non-schema values these keywords legally hold', () => {
    const schema = {
      additionalProperties: false,
      unevaluatedProperties: true,
      items: null,
      allOf: 'not-an-array',
      extends: 'not-an-array',
      properties: [{ title: 'ignored' }],
    };

    expect(() => stripNameKeywordsInPlace(schema)).not.toThrow();
    expect(stripNameKeywordsInPlace(undefined)).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
  });
});

describe('stripTypeDirectivesInPlace', () => {
  it('removes tsType and tsEnumNames from every subschema position', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripTypeDirectivesInPlace(schema);

    expect(JSON.stringify(withoutExtends(schema))).not.toMatch(
      /"(tsType|tsEnumNames)":/,
    );
  });

  it('removes nothing else — the naming keywords are a separate boundary', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripTypeDirectivesInPlace(schema);

    const text = JSON.stringify(schema);

    expect(text).toMatch(/"title":/);
    expect(text).toMatch(/"\$id":/);
    expect(text).toMatch(/"description":/);
  });

  it('leaves the keywords alone where they are not keywords', () => {
    const schema = schemaWhereKeywordsAreNotKeywords();
    const untouched = structuredClone(schema);

    stripTypeDirectivesInPlace(schema);

    expect(schema).toEqual(untouched);
  });
});

describe('stripIdentityNoiseInPlace', () => {
  it('removes naming keywords, type directives and description everywhere', () => {
    const schema = schemaWithNameKeywordsEverywhere();

    stripIdentityNoiseInPlace(schema);

    expect(JSON.stringify(withoutExtends(schema))).not.toMatch(
      /"(title|\$id|id|tsType|tsEnumNames|description)":/,
    );
  });

  it('leaves the keywords alone where they are not keywords', () => {
    const schema = schemaWhereKeywordsAreNotKeywords();
    const untouched = structuredClone(schema);

    stripIdentityNoiseInPlace(schema);

    expect(schema).toEqual(untouched);
  });

  /**
   * The one property `schema-definitions.ts` depends on: a property CALLED
   * `description` is structure and must survive, or two definitions that
   * genuinely differ collapse onto one name.
   */
  it('keeps a property named description as a property', () => {
    const schema = schemaWhereKeywordsAreNotKeywords();

    stripIdentityNoiseInPlace(schema);

    expect(Object.keys(schema['properties'] as object)).toEqual(PROPERTY_KEYS);
  });
});

describe('NameRegistry', () => {
  it('sanitises before it uniquifies, so two candidates never merge', () => {
    const registry = new NameRegistry();

    expect(registry.assign('a', 'pet-owner')).toBe('PetOwner');
    expect(registry.assign('b', 'pet.owner')).toBe('PetOwner_2');
  });

  it('returns one name per key, however often it is asked', () => {
    const registry = new NameRegistry();

    expect(registry.assign('a', 'Pet')).toBe('Pet');
    expect(registry.assign('a', 'Pet')).toBe('Pet');
    expect(registry.assign('b', 'Pet')).toBe('Pet_2');
  });

  it('never hands out a reserved name', () => {
    const registry = new NameRegistry();

    registry.reserve(['Status', 'Selector']);

    expect(registry.assign('a', 'Status')).toBe('Status_2');
    expect(registry.assign('b', 'status')).toBe('Status_3');
  });
});

describe('assignUniqueNames', () => {
  /**
   * The suffix has to be a function of the request SET. Feeding the same two
   * requests in both orders is the cheapest statement of that, and it is what
   * makes the sort in `assignUniqueNames` load-bearing rather than tidy.
   */
  it('assigns in sorted key order, whatever order the requests arrive in', () => {
    const requests = [
      { key: 'b', candidate: 'Foo' },
      { key: 'a', candidate: 'Foo' },
    ];
    const forwards = assignUniqueNames(requests);
    const backwards = assignUniqueNames([...requests].reverse());

    expect(forwards.get('a')).toBe('Foo');
    expect(forwards.get('b')).toBe('Foo_2');
    expect(backwards).toEqual(forwards);
  });

  it('keeps a request that wants the suffixed name distinct from both', () => {
    const assigned = assignUniqueNames([
      { key: 'a', candidate: 'Foo' },
      { key: 'b', candidate: 'Foo' },
      { key: 'c', candidate: 'Foo_2' },
    ]);

    expect([...assigned.values()].sort()).toEqual(['Foo', 'Foo_2', 'Foo_2_2']);
  });
});

describe('applyDefinitionNames', () => {
  it('keeps two keys that differ only in punctuation apart', () => {
    const registry = new NameRegistry();
    const schema = {
      $defs: {
        'pet-owner': { type: 'object', properties: { a: { type: 'string' } } },
        'pet.owner': { type: 'object', properties: { b: { type: 'number' } } },
      },
      properties: {
        a: { $ref: '#/$defs/pet-owner' },
        b: { $ref: '#/$defs/pet.owner' },
      },
    };
    const assignment = assignDefinitionNames([schema], registry);

    applyDefinitionNames(schema, assignment);

    expect(Object.keys(schema.$defs)).toEqual(['PetOwner', 'PetOwner_2']);
    expect(schema.properties.a.$ref).toBe('#/$defs/PetOwner');
    expect(schema.properties.b.$ref).toBe('#/$defs/PetOwner_2');
  });

  it('merges two keys that carry identical content', () => {
    const registry = new NameRegistry();
    const content = { type: 'object', properties: { a: { type: 'string' } } };
    const schema = {
      $defs: { 'pet-owner': { ...content }, 'pet.owner': { ...content } },
    };

    applyDefinitionNames(schema, assignDefinitionNames([schema], registry));

    expect(Object.keys(schema.$defs)).toEqual(['PetOwner']);
  });

  /**
   * Unreachable through `assignDefinitionNames`, which is the point: the
   * failure this replaces dropped one definition, retyped the other, and left
   * `tsc` with nothing to report — the drift oracle reporting success on a
   * corrupted surface. It is asserted directly because "loud, never quiet" is
   * the property, and a guard nobody can trigger is a guard nobody has tested.
   */
  it('aborts rather than letting one definition overwrite another', () => {
    const a = { type: 'object', properties: { a: { type: 'string' } } };
    const b = { type: 'object', properties: { b: { type: 'number' } } };
    const schema = { $defs: { A: a, B: b } };
    const assignment: DefinitionNameAssignment = new Map([
      [
        'A',
        new Map([[definitionIdentity(a), { name: 'Same', definition: a }]]),
      ],
      [
        'B',
        new Map([[definitionIdentity(b), { name: 'Same', definition: b }]]),
      ],
    ]);

    expect(() => applyDefinitionNames(schema, assignment)).toThrow(
      /would both be emitted as "Same"/,
    );
  });

  /**
   * The guard has to compare IDENTITIES, not raw canonical JSON, or it fires on
   * the documentation-only difference the rest of the module deliberately
   * merges — turning a merge into an abort.
   */
  it('does not abort on a documentation-only difference', () => {
    const a = { type: 'object', description: 'One', properties: {} };
    const b = { type: 'object', description: 'Two', properties: {} };
    const schema = { $defs: { A: a, B: b } };
    const identity = definitionIdentity(a);
    const assignment: DefinitionNameAssignment = new Map([
      ['A', new Map([[identity, { name: 'Same', definition: a }]])],
      ['B', new Map([[identity, { name: 'Same', definition: b }]])],
    ]);

    expect(() => applyDefinitionNames(schema, assignment)).not.toThrow();
    expect(Object.keys(schema.$defs)).toEqual(['Same']);
  });
});

describe('identifierOf', () => {
  /**
   * `export const enum` is two keywords, and ordered alternation read the first
   * as the declaration keyword and the second as the NAME: `identifierOf`
   * returned the literal string `"enum"`, so every `const enum` in a file sorted
   * and de-duplicated as if it were the same declaration. The library really can
   * emit one — a schema carrying `tsEnumNames` reaches its `NAMED_ENUM` branch
   * and mints `export const enum Kind` — which is why this is a bug rather than
   * a hypothetical.
   */
  it('reads the name of a const enum, not the word "enum"', () => {
    expect(identifierOf('export const enum Kind {\n  Hijack = "a"\n}')).toBe(
      'Kind',
    );
    expect(identifierOf('export declare const enum Kind {}')).toBe('Kind');
  });

  it('still reads every other declaration shape', () => {
    expect(identifierOf('export const x = 1')).toBe('x');
    expect(identifierOf('export interface Pet {}')).toBe('Pet');
    expect(identifierOf('export type Selector = string')).toBe('Selector');
    expect(identifierOf('export enum Kind {}')).toBe('Kind');
    expect(identifierOf('export declare const y = 1')).toBe('y');
    expect(identifierOf('something else entirely')).toBe('');
  });
});

/** The identifiers one `generateTypeForSchema` call declares, in emitted order. */
async function declaredNames(
  schema: unknown,
  typeName = 'GetPets200ResponseBody',
): Promise<string[]> {
  const generated = await generateTypeForSchema(
    schema,
    'application/json',
    typeName,
  );

  return generated.declarations
    .flatMap((declaration) => splitDeclarations(declaration))
    .map((declaration) => identifierOf(declaration));
}

/**
 * THE STRIP, PINNED AGAINST THE REAL GENERATOR.
 *
 * Every case here is a defect class a previous round shipped, and every one is
 * asserted on the emitted DECLARATION NAMES rather than on `tsc` diagnostics —
 * because the worst member of this class is `tsc`-clean by construction. The
 * postcondition in `emitted-names.ts` is a SEPARATE net under the same hazards
 * and is tested separately below; nothing here depends on it, so it is
 * unambiguous which mechanism each test pins.
 */
describe('the strip, against the real generator', () => {
  it('does not let a draft-04 id name the root declaration', async () => {
    expect(
      await declaredNames({
        id: 'Pet',
        type: 'object',
        properties: { a: { type: 'string' } },
      }),
    ).toEqual(['GetPets200ResponseBody']);
  });

  /**
   * THE SILENT ONE. Before the strip this emits `interface Owner` carrying Pet's
   * body and `interface Owner1` carrying Owner's, with `p?: Owner` pointing at
   * the wrong schema and zero `tsc` diagnostics. The filter cannot hide a
   * counter-minted sibling: `generateName` only ever appends a decimal counter
   * to the `toSafeString` base, so every sibling of `Pet` or `Owner` is
   * prefix-matched by the regex and breaks the exact `toEqual`.
   */
  it('does not let a $defs entry id steal a sibling declaration', async () => {
    const schema = {
      type: 'object',
      properties: {
        p: { $ref: '#/$defs/Pet' },
        o: { $ref: '#/$defs/Owner' },
      },
      $defs: {
        Pet: {
          id: 'Owner',
          type: 'object',
          properties: { petName: { type: 'string' } },
        },
        Owner: {
          type: 'object',
          properties: { ownerName: { type: 'string' } },
        },
      },
    };
    const generated = await generateTypeForSchema(
      schema,
      'application/json',
      'GetPets200ResponseBody',
    );
    const declarations = generated.declarations.flatMap((declaration) =>
      splitDeclarations(declaration),
    );
    const named = new Map(
      declarations.map((declaration) => [
        identifierOf(declaration),
        declaration,
      ]),
    );

    expect(
      [...named.keys()].filter((name) => /^(Pet|Owner)/.test(name)).sort(),
    ).toEqual(['Owner', 'Pet']);
    expect(named.get('Pet')).toContain('petName?: string');
    expect(named.get('Owner')).toContain('ownerName?: string');
    expect(named.get('GetPets200ResponseBody')).toContain('p?: Pet');
    expect(named.get('GetPets200ResponseBody')).toContain('o?: Owner');
  });

  /**
   * Round 4 asserted a hard ABORT here. Round 5 reversed that — see
   * `foldExtendsInPlace`: the description compiled correctly before the abort
   * was introduced, so the abort was the regression. The super-type is now
   * folded into `allOf`, which the strip does enter.
   */
  it('does not let a title inside extends declare an interface', async () => {
    expect(
      await declaredNames({
        type: 'object',
        properties: { a: { type: 'string' } },
        extends: [
          {
            title: 'HijackExtends',
            type: 'object',
            properties: { b: { type: 'string' } },
          },
        ],
      }),
    ).toEqual(['GetPets200ResponseBody']);
  });

  it('does not let a title inside array-form items declare an interface', async () => {
    expect(
      await declaredNames({
        type: 'array',
        items: [
          {
            title: 'HijackItems',
            type: 'object',
            properties: { b: { type: 'string' } },
          },
        ],
      }),
    ).toEqual(['GetPets200ResponseBody']);
  });

  it('does not let a title inside additionalItems declare an interface', async () => {
    expect(
      await declaredNames({
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: {
          title: 'HijackAdditional',
          type: 'object',
          properties: { b: { type: 'string' } },
        },
      }),
    ).toEqual(['GetPets200ResponseBody']);
  });

  /**
   * The type directives are stripped one boundary EARLIER than the naming
   * keywords — on the description's schema, before example reflection writes
   * `tsType` of its own — so they are exercised through
   * {@link stripTypeDirectivesInPlace} rather than through the compile boundary.
   * The wiring and its ORDER are pinned in
   * `generate-request-types-surface.test.ts`.
   */
  it('does not let tsEnumNames mint an unreserved const enum', async () => {
    const schema: unknown = {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['a'], tsEnumNames: ['Hijack'] },
      },
    };

    // Unstripped, the `const enum Kind` it mints is an identifier nothing
    // reserved — and the postcondition, which needs no keyword list, says so.
    await expect(
      generateTypeForSchema(
        structuredClone(schema),
        'application/json',
        'GetPets200ResponseBody',
      ),
    ).rejects.toThrow(/"Kind"/);

    const stripped: unknown = structuredClone(schema);

    stripTypeDirectivesInPlace(stripped);

    const generated = await generateTypeForSchema(
      stripped,
      'application/json',
      'GetPets200ResponseBody',
    );

    expect(await declaredNames(stripped)).toEqual(['GetPets200ResponseBody']);
    // AC6: `enum` is left as-is, i.e. still a closed literal union.
    expect(generated.declarations.join('\n')).toContain('kind?: "a"');
  });

  it('does not let tsType write TypeScript into the surface', async () => {
    const schema: unknown = {
      type: 'object',
      properties: { a: { type: 'string', tsType: 'SomethingUndeclared' } },
    };
    const before = await generateTypeForSchema(
      structuredClone(schema),
      'application/json',
      'GetPets200ResponseBody',
    );

    expect(before.declarations.join('\n')).toContain('a?: SomethingUndeclared');

    const stripped: unknown = structuredClone(schema);

    stripTypeDirectivesInPlace(stripped);

    const after = await generateTypeForSchema(
      stripped,
      'application/json',
      'GetPets200ResponseBody',
    );

    expect(after.declarations.join('\n')).toContain('a?: string');
    expect(after.declarations.join('\n')).not.toContain('SomethingUndeclared');
  });
});

/**
 * THE POSTCONDITION, TESTED ON ITS OWN.
 *
 * The strip above removes these keywords before `compile()` sees them, so with
 * the strip in place the postcondition never fires for them — which would make
 * "it throws" untestable through `generateTypeForSchema`. So the violations are
 * driven through the same `compile()` call MINUS the strip, and the assertion is
 * asked directly. That keeps the two mechanisms independently falsifiable: if
 * the strip regresses, the tests above fail; if the postcondition regresses,
 * these do.
 */
const COMPILE_OPTIONS = {
  bannerComment: '',
  additionalProperties: true,
  style: { semi: false },
  $refOptions: { mutateInputSchema: true },
} as const;

async function compiledWithoutStrip(
  schema: unknown,
  name: string,
): Promise<{ compilable: unknown; compiled: string }> {
  const compilable = convertDefsToDefinitions(structuredClone(schema));
  const compiled = await compile(
    compilable as JSONSchema,
    name,
    COMPILE_OPTIONS,
  );

  return { compilable, compiled };
}

function escapeError(fn: () => void): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the postcondition to throw, but it did not.');
}

/**
 * Eighteen shapes the real generator produces legitimately. The postcondition
 * has one failure mode that matters more than a missed defect — aborting a
 * generation that was fine — so the false-positive surface is enumerated
 * explicitly and run through the real `compile()`.
 */
const NO_VIOLATION: readonly (readonly [string, unknown, string])[] = [
  [
    'simple object',
    { type: 'object', properties: { a: { type: 'string' } } },
    'GetPets200ResponseBody',
  ],
  [
    '$defs.Pet referenced',
    {
      type: 'object',
      properties: { p: { $ref: '#/$defs/Pet' } },
      $defs: { Pet: { type: 'object', properties: { n: { type: 'string' } } } },
    },
    'GetPets200ResponseBody',
  ],
  [
    "$defs['pet-owner']",
    {
      type: 'object',
      properties: { p: { $ref: '#/$defs/pet-owner' } },
      $defs: {
        'pet-owner': { type: 'object', properties: { n: { type: 'string' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    "$defs['pet_owner']",
    {
      type: 'object',
      properties: { p: { $ref: '#/$defs/pet_owner' } },
      $defs: {
        pet_owner: { type: 'object', properties: { n: { type: 'string' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'nested $defs/Wrap/$defs/Inner',
    {
      type: 'object',
      properties: { w: { $ref: '#/$defs/Wrap' } },
      $defs: {
        Wrap: {
          type: 'object',
          properties: { i: { $ref: '#/$defs/Wrap/$defs/Inner' } },
          $defs: {
            Inner: { type: 'object', properties: { n: { type: 'string' } } },
          },
        },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    "$defs['pet-owner'] + $defs['pet.owner'] (PetOwner and Pet)",
    {
      type: 'object',
      properties: {
        a: { $ref: '#/$defs/pet-owner' },
        b: { $ref: '#/$defs/pet.owner' },
      },
      $defs: {
        'pet-owner': { type: 'object', properties: { a: { type: 'string' } } },
        'pet.owner': { type: 'object', properties: { b: { type: 'number' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    "$defs['pet-owner'] + $defs['pet_owner'] (PetOwner and PetOwner1)",
    {
      type: 'object',
      properties: {
        a: { $ref: '#/$defs/pet-owner' },
        b: { $ref: '#/$defs/pet_owner' },
      },
      $defs: {
        'pet-owner': { type: 'object', properties: { a: { type: 'string' } } },
        pet_owner: { type: 'object', properties: { b: { type: 'number' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'three keys on one base (PetOwner, PetOwner1, PetOwner2)',
    {
      type: 'object',
      properties: {
        a: { $ref: '#/$defs/pet-owner' },
        b: { $ref: '#/$defs/pet_owner' },
        c: { $ref: '#/$defs/pet owner' },
      },
      $defs: {
        'pet-owner': { type: 'object', properties: { a: { type: 'string' } } },
        pet_owner: { type: 'object', properties: { b: { type: 'number' } } },
        'pet owner': { type: 'object', properties: { c: { type: 'boolean' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'array-form items with no title',
    { type: 'array', items: [{ type: 'string' }, { type: 'number' }] },
    'GetPets200ResponseBody',
  ],
  [
    'allOf with a $ref',
    {
      allOf: [
        { $ref: '#/$defs/Pet' },
        { type: 'object', properties: { extra: { type: 'string' } } },
      ],
      $defs: { Pet: { type: 'object', properties: { n: { type: 'string' } } } },
    },
    'GetPets200ResponseBody',
  ],
  [
    "$defs['_400']",
    {
      type: 'object',
      properties: { e: { $ref: '#/$defs/_400' } },
      $defs: {
        _400: { type: 'object', properties: { n: { type: 'string' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'recursive $defs.Node referenced twice',
    {
      type: 'object',
      properties: { a: { $ref: '#/$defs/Node' }, b: { $ref: '#/$defs/Node' } },
      $defs: {
        Node: {
          type: 'object',
          properties: { next: { $ref: '#/$defs/Node' } },
        },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'dependentSchemas',
    {
      type: 'object',
      properties: { a: { type: 'string' } },
      dependentSchemas: {
        a: { type: 'object', properties: { b: { type: 'string' } } },
      },
    },
    'GetPets200ResponseBody',
  ],
  [
    'patternProperties holding a $ref',
    {
      type: 'object',
      patternProperties: { '^x-': { $ref: '#/$defs/Pet' } },
      $defs: { Pet: { type: 'object', properties: { n: { type: 'string' } } } },
    },
    'GetPets200ResponseBody',
  ],
  [
    'a top-level $ref plus $defs',
    {
      $ref: '#/$defs/Pet',
      $defs: { Pet: { type: 'object', properties: { n: { type: 'string' } } } },
    },
    'GetPets200ResponseBody',
  ],
  ['a primitive root', { type: 'string' }, 'GetPets200ResponseBody'],
  ['an empty root', {}, 'GetPets200ResponseBody'],
  [
    'a root name that collides with a $defs key (Pet and Pet1)',
    {
      type: 'object',
      properties: { p: { $ref: '#/$defs/Pet' } },
      $defs: { Pet: { type: 'object', properties: { n: { type: 'string' } } } },
    },
    'Pet',
  ],
];

describe('assertEmittedNamesWereIssued', () => {
  it.each(NO_VIOLATION)(
    'accepts what the real generator legitimately emits: %s',
    async (_label, schema, name) => {
      await expect(
        generateTypeForSchema(schema, 'application/json', name),
      ).resolves.toBeDefined();
    },
  );

  it('has exactly the eighteen no-violation rows the design enumerates', () => {
    expect(NO_VIOLATION).toHaveLength(18);
  });

  /**
   * The counter suffixes the entitled set has to tolerate, stated as emitted
   * names rather than left implicit in the entitlement arithmetic. Two distinct
   * pointers collapsing onto one base really do produce `PetOwner1`, and a root
   * name colliding with a `$defs` key really does produce `Pet1`.
   */
  it('tolerates the counter suffixes a genuine collision produces', async () => {
    expect(
      (
        await declaredNames({
          type: 'object',
          properties: {
            a: { $ref: '#/$defs/pet-owner' },
            b: { $ref: '#/$defs/pet_owner' },
          },
          $defs: {
            'pet-owner': {
              type: 'object',
              properties: { a: { type: 'string' } },
            },
            pet_owner: {
              type: 'object',
              properties: { b: { type: 'number' } },
            },
          },
        })
      ).sort(),
    ).toEqual(['GetPets200ResponseBody', 'PetOwner', 'PetOwner1']);

    expect(
      (
        await declaredNames(
          {
            type: 'object',
            properties: { p: { $ref: '#/$defs/Pet' } },
            $defs: {
              Pet: { type: 'object', properties: { n: { type: 'string' } } },
            },
          },
          'Pet',
        )
      ).sort(),
    ).toEqual(['Pet', 'Pet1']);
  });

  it('rejects a root the schema named itself, via a draft-04 id', async () => {
    const { compilable, compiled } = await compiledWithoutStrip(
      { id: 'Pet', type: 'object', properties: { a: { type: 'string' } } },
      'GetPets200ResponseBody',
    );
    const error = escapeError(() =>
      assertEmittedNamesWereIssued(
        compiled,
        compilable,
        'GetPets200ResponseBody',
      ),
    );

    expect(error.name).toBe('GeneratedNameEscapeError');
    expect(error.message).toContain('"Pet"');
    expect(error.message).toContain('GetPets200ResponseBody');
    expect(error.options.suggestions?.join(' ')).toContain(
      'defect in the generated type surface',
    );
    // The description is named as a possible cause FIRST, because every
    // reproduction of this abort so far was caused by the description.
    expect(error.options.suggestions?.[0]).toContain('API description');
  });

  /**
   * THE ONE THE ROUND-3 PRESCRIPTION MISSED, and the reason the check has a set
   * half at all. The ROOT declaration here is named correctly, so a root-only
   * check passes while the file emits `Owner` carrying Pet's body and `Owner1`
   * carrying Owner's. `Owner1` is the tell: `Owner` is reached by ONE pointer
   * site, so a counter suffix on it was never entitled.
   *
   * This test is what fails if the counter tolerance is loosened from
   * `b1 … b(m-1)` to `b1 … b(m)`, and what fails if the check is reduced to the
   * root declaration.
   */
  it('rejects the silent case, where the root name is correct', async () => {
    const { compilable, compiled } = await compiledWithoutStrip(
      {
        type: 'object',
        properties: {
          p: { $ref: '#/$defs/Pet' },
          o: { $ref: '#/$defs/Owner' },
        },
        $defs: {
          Pet: {
            id: 'Owner',
            type: 'object',
            properties: { petName: { type: 'string' } },
          },
          Owner: {
            type: 'object',
            properties: { ownerName: { type: 'string' } },
          },
        },
      },
      'GetPets200ResponseBody',
    );

    // The root really is named correctly, which is exactly why a root-only
    // check is not enough.
    expect(splitDeclarations(compiled).map(identifierOf)).toContain(
      'GetPets200ResponseBody',
    );

    const error = escapeError(() =>
      assertEmittedNamesWereIssued(
        compiled,
        compilable,
        'GetPets200ResponseBody',
      ),
    );

    expect(error.name).toBe('GeneratedNameEscapeError');
    // The obligation half names the REAL defect: `Pet` was declared by nothing.
    // Round 4 could only report the symptom (an unexpected `Owner1`).
    expect(error.message).toContain('Pet');
    expect(error.message).toContain('nothing was declared');
  });

  /**
   * THE REASON THE BOUND IS TIGHT RATHER THAN GENEROUS, and the case a
   * count-every-occurrence rule gives away. `plugin-openapi` hoists
   * `components/schemas` into `$defs`, so a schema referenced from two
   * properties is the ORDINARY shape — not the exotic one. Counting occurrences
   * would give `Owner` a multiplicity of two, entitle `Owner1`, and let the
   * hijack through on a file `tsc` calls clean.
   *
   * Asserted on the emitted declaration NAMES, because there are no diagnostics
   * to assert on: the surface below compiles with zero errors while `p` is typed
   * as the wrong schema.
   */
  it('rejects the silent case even when the target is referenced twice', async () => {
    const { compilable, compiled } = await compiledWithoutStrip(
      {
        type: 'object',
        properties: {
          p: { $ref: '#/$defs/Pet' },
          o1: { $ref: '#/$defs/Owner' },
          o2: { $ref: '#/$defs/Owner' },
        },
        $defs: {
          Pet: {
            id: 'Owner',
            type: 'object',
            properties: { petName: { type: 'string' } },
          },
          Owner: {
            type: 'object',
            properties: { ownerName: { type: 'string' } },
          },
        },
      },
      'GetPets200ResponseBody',
    );

    // The corruption, stated as names: `Owner` carries Pet's body, and the
    // registry never issued `Owner1`.
    expect(splitDeclarations(compiled).map(identifierOf)).toEqual([
      'GetPets200ResponseBody',
      'Owner',
      'Owner1',
    ]);

    const error = escapeError(() =>
      assertEmittedNamesWereIssued(
        compiled,
        compilable,
        'GetPets200ResponseBody',
      ),
    );

    expect(error.name).toBe('GeneratedNameEscapeError');
    expect(error.message).toContain('Pet');
  });

  it.each([
    [
      'a title inside extends',
      {
        type: 'object',
        properties: { a: { type: 'string' } },
        extends: [
          {
            title: 'HijackExtends',
            type: 'object',
            properties: { b: { type: 'string' } },
          },
        ],
      },
      'HijackExtends',
    ],
    [
      'a title inside array-form items',
      {
        type: 'array',
        items: [
          {
            title: 'HijackItems',
            type: 'object',
            properties: { b: { type: 'string' } },
          },
        ],
      },
      'HijackItems',
    ],
    [
      'a title inside additionalItems',
      {
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: {
          title: 'HijackAdditional',
          type: 'object',
          properties: { b: { type: 'string' } },
        },
      },
      'HijackAdditional',
    ],
    [
      'tsEnumNames',
      {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['a'], tsEnumNames: ['Hijack'] },
        },
      },
      'Kind',
    ],
  ])('rejects %s', async (_label, schema, offender) => {
    const { compilable, compiled } = await compiledWithoutStrip(
      schema,
      'GetPets200ResponseBody',
    );
    const error = escapeError(() =>
      assertEmittedNamesWereIssued(
        compiled,
        compilable,
        'GetPets200ResponseBody',
      ),
    );

    expect(error.name).toBe('GeneratedNameEscapeError');
    expect(error.message).toContain(`"${offender}"`);
  });
});

/**
 * THE BOUND, AS A TABLE, MEASURED AGAINST THE REAL COMPILER.
 *
 * How many declarations one pointer target is entitled to is the whole strength
 * of the postcondition, and it is the piece most likely to drift on a library
 * bump. Each row states the expected DECLARATION NAMES; the test compiles the
 * row for real and requires the entitled set to be exactly that — so a row is
 * falsified both by the library changing and by the rule drifting, in either
 * direction.
 *
 * Two wrong rules were tried before this one, and both are visible here. Keying
 * on DISTINCT POINTER STRINGS fails the `sibling ×2` rows. Counting EVERY
 * OCCURRENCE fails nothing here but gives away the case the check exists for —
 * see `rejects the silent case even when the target is referenced twice`.
 */
const N_DEF = { type: 'object', properties: { n: { type: 'string' } } };
const PLAIN = { $ref: '#/definitions/N' };
const WITH_EXAMPLES = { $ref: '#/definitions/N', examples: [{ n: 'x' }] };
const withDescription = (description: string) => ({
  $ref: '#/definitions/N',
  description,
});
const rootOver = (
  properties: Record<string, unknown>,
  definitions: Record<string, unknown> = { N: N_DEF },
) => ({ type: 'object', properties, definitions });
const RECURSIVE = {
  type: 'object',
  properties: { next: { $ref: '#/definitions/Rec' } },
};

const MULTIPLICITY_TABLE: readonly (readonly [
  string,
  unknown,
  readonly string[],
])[] = [
  ['plain ref x1', rootOver({ a: PLAIN }), ['Root', 'N']],
  ['plain ref x2', rootOver({ a: PLAIN, b: PLAIN }), ['Root', 'N']],
  ['plain ref x3', rootOver({ a: PLAIN, b: PLAIN, c: PLAIN }), ['Root', 'N']],
  [
    'plain ref x4',
    rootOver({ a: PLAIN, b: PLAIN, c: PLAIN, d: PLAIN }),
    ['Root', 'N'],
  ],
  ['ref + sibling examples x1', rootOver({ a: WITH_EXAMPLES }), ['Root', 'N']],
  [
    'ref + sibling examples x2',
    rootOver({ a: WITH_EXAMPLES, b: WITH_EXAMPLES }),
    ['Root', 'N', 'N1'],
  ],
  [
    'ref + sibling examples x3',
    rootOver({ a: WITH_EXAMPLES, b: WITH_EXAMPLES, c: WITH_EXAMPLES }),
    ['Root', 'N', 'N1', 'N2'],
  ],
  [
    'plain + ref with a sibling',
    rootOver({ a: PLAIN, b: WITH_EXAMPLES }),
    ['Root', 'N', 'N1'],
  ],
  [
    'plain + ref with a sibling description',
    rootOver({ a: PLAIN, b: withDescription('doc') }),
    ['Root', 'N', 'N1'],
  ],
  [
    'two refs with sibling descriptions',
    rootOver({ a: withDescription('one'), b: withDescription('two') }),
    ['Root', 'N', 'N1'],
  ],
  [
    'two refs with IDENTICAL sibling descriptions',
    rootOver({ a: withDescription('same'), b: withDescription('same') }),
    ['Root', 'N', 'N1'],
  ],
  [
    'allOf-wrapped ref x2',
    rootOver({ a: { allOf: [PLAIN] }, b: { allOf: [PLAIN] } }),
    ['Root', 'N'],
  ],
  [
    'ref inside array items x2',
    rootOver({
      a: { type: 'array', items: PLAIN },
      b: { type: 'array', items: PLAIN },
    }),
    ['Root', 'N'],
  ],
  [
    'an unknown x- key as the sibling, x2',
    rootOver({
      a: { $ref: '#/definitions/N', 'x-foo': 1 },
      b: { $ref: '#/definitions/N', 'x-foo': 2 },
    }),
    ['Root', 'N', 'N1'],
  ],
  [
    'self-recursive, plain',
    {
      type: 'object',
      properties: { next: { $ref: '#/definitions/Rec' } },
      definitions: { Rec: RECURSIVE },
    },
    ['Root', 'Rec'],
  ],
  [
    'self-recursive, one sibling',
    {
      type: 'object',
      properties: {
        next: { $ref: '#/definitions/Rec', examples: [{}] },
      },
      definitions: { Rec: RECURSIVE },
    },
    ['Root', 'Rec', 'Rec1'],
  ],
  /**
   * The row that forced the plain side to de-duplicate by POINTER rather than by
   * BASE: two plain pointers to two different targets whose names both collapse
   * onto `PetOwner`. Keying on the base entitled only one and rejected this.
   */
  [
    'two distinct plain pointers onto one base',
    {
      type: 'object',
      properties: {
        a: { $ref: '#/definitions/pet-owner' },
        b: { $ref: '#/definitions/pet_owner' },
      },
      definitions: {
        'pet-owner': { type: 'object', properties: { a: { type: 'string' } } },
        pet_owner: { type: 'object', properties: { b: { type: 'number' } } },
      },
    },
    ['Root', 'PetOwner', 'PetOwner1'],
  ],
];

/**
 * These seventeen rows were measured against the real library and they keep
 * their value; what changed in round 5 is what is asserted ABOUT them.
 *
 * Round 4 asserted an EXACT entitled set — `b` plus `b1 … b(m-1)` for a base
 * reached by `m` sites — and that model was falsified in the one direction that
 * matters: it aborts valid descriptions, because `generateName`'s counter pool
 * is global rather than per base. The rows now assert the property the
 * postcondition actually promises: whatever the library emits for these
 * seventeen shapes, the check ACCEPTS it. A table of real outputs is the right
 * defence against a false positive; it was never evidence for a bound.
 */
describe('the postcondition on real library output', () => {
  it.each(MULTIPLICITY_TABLE)(
    'accepts what the library really emits: %s',
    async (_label, schema, expected) => {
      const compiled = await compile(
        structuredClone(schema) as JSONSchema,
        'Root',
        COMPILE_OPTIONS,
      );

      // The measurement itself — what this library version does with this shape.
      expect(splitDeclarations(compiled).map(identifierOf)).toEqual([
        ...expected,
      ]);
      expect(() =>
        assertEmittedNamesWereIssued(compiled, schema, 'Root'),
      ).not.toThrow();
    },
  );

  it('has all seventeen measured rows', () => {
    expect(MULTIPLICITY_TABLE).toHaveLength(17);
  });

  it('permits exactly the names the schema accounts for', () => {
    const schema = {
      type: 'object',
      properties: { p: { $ref: '#/definitions/Pet' } },
      definitions: { Pet: { type: 'object' } },
    };

    expect([...permittedBases(schema, 'RootName')].sort()).toEqual([
      'Pet',
      'RootName',
    ]);
  });

  /**
   * WHICH DERIVATION WINS DEPENDS ON THE TARGET'S TYPE, and round 4 predicted it
   * and got it wrong. The normalizer synthesises `$id = toSafeString(justName(
   * pointer))` only for object- and array-typed targets; for a scalar it returns
   * early and the RAW `$defs` key names the declaration. So `#/definitions/
   * pet.owner` declares `Pet` in one case and `PetOwner` in the other, from one
   * pointer string. Both are accepted, and both are asserted against the real
   * library rather than against this module's arithmetic.
   */
  it.each([
    ['object target, the $id derivation wins', { type: 'object' }, 'Pet'],
    ['scalar target, the raw key wins', { type: 'string' }, 'PetOwner'],
  ])(
    'accepts either derivation of a dotted key: %s',
    async (_label, target, expected) => {
      const schema = {
        type: 'object',
        properties: { a: { $ref: '#/definitions/pet.owner' } },
        definitions: { 'pet.owner': target },
      };
      const compiled = await compile(
        structuredClone(schema) as JSONSchema,
        'RootName',
        COMPILE_OPTIONS,
      );

      expect(splitDeclarations(compiled).map(identifierOf)).toContain(expected);
      expect(() =>
        assertEmittedNamesWereIssued(compiled, schema, 'RootName'),
      ).not.toThrow();
    },
  );

  /**
   * The PERMISSION half is blind on purpose: it may only ever be too generous,
   * so a `$ref`-shaped value sitting in example DATA widens it harmlessly. The
   * obligation half is the position-aware one, and it must NOT see this pointer
   * — asserted separately, because a false obligation aborts a valid file.
   */
  it('permits blindly, wherever a pointer sits', () => {
    const schema = {
      anyOf: [{ items: [{ $ref: '#/definitions/Pet' }] }],
      examples: [{ $ref: '#/definitions/NotReallyAPointer' }],
    };

    expect([...permittedBases(schema, 'RootName')].sort()).toEqual([
      'NotReallyAPointer',
      'Pet',
      'RootName',
    ]);
  });
});

describe('$defs identity is the emitted type, not the documentation', () => {
  const petWith = (description: string) => ({
    type: 'object',
    description,
    properties: { name: { type: 'string' } },
  });

  /**
   * AC8's premise is that the drift comparison strips comments and JSDoc so a
   * documentation-only spec edit is a NON-EVENT. Keyed on the raw definition,
   * `description` was part of a definition's identity, so editing one produced a
   * whole new `Pet_2` declaration plus a flipped alias — a structural diff that
   * survives comment-stripping.
   */
  it('gives two documentation-only variants one name and one body', () => {
    const registry = new NameRegistry();
    const first = { $defs: { Pet: petWith('One way.') } };
    const second = { $defs: { Pet: petWith('Another way.') } };
    const assignment = assignDefinitionNames([first, second], registry);

    applyDefinitionNames(first, assignment);
    applyDefinitionNames(second, assignment);

    expect(Object.keys(first.$defs)).toEqual(['Pet']);
    expect(Object.keys(second.$defs)).toEqual(['Pet']);
    // The REPRESENTATIVE — the first seen, in catalog order — is what both
    // emit. Leaving each schema its own body would give one identifier two
    // JSDoc comments, and `DeclarationSet` de-duplicates on TEXT, so the
    // surface would carry `export interface Pet` twice.
    expect(second.$defs.Pet).toEqual(petWith('One way.'));
    expect(first.$defs.Pet).toEqual(petWith('One way.'));
  });

  it('keeps definitions that differ in structure apart', () => {
    const registry = new NameRegistry();
    const first = { $defs: { Pet: petWith('One way.') } };
    const second = {
      $defs: {
        Pet: {
          type: 'object',
          description: 'One way.',
          properties: { legs: { type: 'number' } },
        },
      },
    };
    const assignment = assignDefinitionNames([first, second], registry);

    applyDefinitionNames(first, assignment);
    applyDefinitionNames(second, assignment);

    expect(Object.keys(first.$defs)).toEqual(['Pet']);
    expect(Object.keys(second.$defs)).toEqual(['Pet_2']);
  });

  it('treats title the same way as description', () => {
    const registry = new NameRegistry();
    const titled = (title: string) => ({
      type: 'object',
      title,
      properties: { name: { type: 'string' } },
    });
    const first = { $defs: { Pet: titled('One') } };
    const second = { $defs: { Pet: titled('Two') } };
    const assignment = assignDefinitionNames([first, second], registry);

    applyDefinitionNames(first, assignment);
    applyDefinitionNames(second, assignment);

    expect(Object.keys(second.$defs)).toEqual(['Pet']);
  });

  it('does not alias the representative into the caller`s tree', () => {
    const registry = new NameRegistry();
    const representative = petWith('One way.');
    const first = { $defs: { Pet: representative } };
    const second = { $defs: { Pet: petWith('Another way.') } };
    const assignment = assignDefinitionNames([first, second], registry);

    applyDefinitionNames(second, assignment);

    expect(second.$defs.Pet).not.toBe(representative);
  });

  it('ignores documentation nested anywhere in the subtree', () => {
    const nested = (description: string) => ({
      type: 'object',
      properties: { inner: { type: 'object', description, properties: {} } },
    });

    expect(definitionIdentity(nested('a'))).toBe(
      definitionIdentity(nested('b')),
    );
  });
});

/**
 * Round 5. The postcondition round 4 added models the library's counter
 * arithmetic, and that model is wrong in a direction that ABORTS VALID INPUT.
 * Three independent reproductions, all measured against the real library:
 * `generateName`'s counter is drawn from ONE global `usedNames` set for the
 * whole `compile()`, while `entitledNames` counted per base.
 *
 * These are not hypothetical shapes. `plugin-openapi`'s `createDefinitionName`
 * preserves case and digits and only dedupes on exact match, so `components/
 * schemas: { Pet, Pet1, pet }` produces exactly these `$defs` keys.
 */
describe('the postcondition never aborts a valid generation', () => {
  it('tolerates a counter the library drew from its GLOBAL name pool', async () => {
    const schema = {
      type: 'object',
      properties: {
        a: { $ref: '#/$defs/Pet' },
        b: { $ref: '#/$defs/Pet1' },
        c: { $ref: '#/$defs/pet' },
      },
      $defs: {
        Pet: { type: 'object', properties: { x: { type: 'string' } } },
        Pet1: { type: 'object', properties: { y: { type: 'string' } } },
        pet: { type: 'object', properties: { z: { type: 'string' } } },
      },
    };

    const generated = await generateTypeForSchema(
      schema,
      'application/json',
      'RootName',
    );
    const declared = generated.declarations
      .flatMap((declaration) => splitDeclarations(declaration))
      .map(identifierOf);

    // Three distinct definitions, three distinct declarations, nothing lost.
    expect(declared).toContain('Pet');
    expect(declared).toContain('Pet1');
    expect(declared).toContain('Pet2');
    expect(new Set(declared).size).toBe(declared.length);
  });

  /**
   * The normalizer only synthesises `$id` for object- and array-typed targets
   * (`normalizer.js:61`); for a scalar it returns early, so
   * `keyNameFromDefinition` — the RAW `$defs` key — names the declaration and
   * `justName` never gets to strip the dot. The round-4 model assumed the
   * pointer derivation always wins.
   */
  it('tolerates a dotted key whose target is scalar, where the RAW key wins', async () => {
    const schema = {
      type: 'object',
      properties: { a: { $ref: '#/$defs/pet.owner' } },
      $defs: { 'pet.owner': { type: 'string' } },
    };

    const generated = await generateTypeForSchema(
      schema,
      'application/json',
      'RootName',
    );

    expect(
      generated.declarations
        .flatMap((declaration) => splitDeclarations(declaration))
        .map(identifierOf),
    ).toContain('PetOwner');
  });

  /**
   * The counter walks PAST a name another `$defs` key already occupies, so the
   * suffix is not even contiguous: `Pet` + a sibling-bearing pointer to `Pet`
   * mints `Pet11` when `Pet1` is taken. Both halves — a `$ref` carrying a
   * `description` sibling, and `Pet`/`Pet1` as schema names — are ordinary.
   */
  it('tolerates a counter that walked past an occupied sibling name', async () => {
    const schema = {
      type: 'object',
      properties: {
        a: { $ref: '#/$defs/Pet' },
        b: { $ref: '#/$defs/Pet', description: 'the same pet, annotated' },
        c: { $ref: '#/$defs/Pet1' },
      },
      $defs: {
        Pet: { type: 'object', properties: { x: { type: 'string' } } },
        Pet1: { type: 'object', properties: { y: { type: 'string' } } },
      },
    };

    await expect(
      generateTypeForSchema(schema, 'application/json', 'RootName'),
    ).resolves.toBeDefined();
  });
});

/**
 * The other direction, and the one the postcondition exists for. Round 4's
 * amendment credits it with closing the SILENT class — a `tsc`-clean file whose
 * alias points at the wrong schema — so that property has to be asserted
 * directly rather than inferred from the counter arithmetic.
 *
 * This is the exact output shape the `id` hijack produced at `4f85d53e`:
 * `$defs.Pet` renamed itself `Owner`, the registry's real `Owner` was pushed to
 * a counter, and `Pet` was declared by nothing. Asserted on a handcrafted
 * `compiled` string because the strip now prevents the library from producing
 * it — a guard that can only be tested through the bug it prevents is a guard
 * that stops being tested the moment the bug is fixed.
 */
describe('the postcondition still catches a name that was hijacked', () => {
  const schema = {
    type: 'object',
    properties: {
      p: { $ref: '#/definitions/Pet' },
      o: { $ref: '#/definitions/Owner' },
    },
    definitions: {
      Pet: { type: 'object', properties: { petName: { type: 'string' } } },
      Owner: { type: 'object', properties: { ownerName: { type: 'string' } } },
    },
  };

  it('aborts when a referenced definition declares nothing at all', () => {
    const hijacked = [
      'export interface Root {',
      '  p?: Owner',
      '  o?: Owner1',
      '}',
      'export interface Owner {',
      '  petName?: string',
      '}',
      'export interface Owner1 {',
      '  ownerName?: string',
      '}',
    ].join('\n');

    expect(() =>
      assertEmittedNamesWereIssued(hijacked, schema, 'Root'),
    ).toThrow(/Pet/);
  });

  it('accepts the same surface when every definition kept its own name', () => {
    const honest = [
      'export interface Root {',
      '  p?: Pet',
      '  o?: Owner',
      '}',
      'export interface Pet {',
      '  petName?: string',
      '}',
      'export interface Owner {',
      '  ownerName?: string',
      '}',
    ].join('\n');

    expect(() =>
      assertEmittedNamesWereIssued(honest, schema, 'Root'),
    ).not.toThrow();
  });

  /**
   * The root check on its own, with NOTHING else able to fire: `Pet` is
   * permitted (the schema references it) and its obligation is met (it is
   * declared), so the only fault left is that the name the call returns was
   * never declared. Written this way because the obvious version — an output
   * declaring some unrelated `Something` — also trips the permission half, so it
   * passes with the root check deleted and proves nothing.
   */
  it('still requires the returned name to be declared', () => {
    const error = escapeError(() =>
      assertEmittedNamesWereIssued(
        'export interface Pet {\n  petName?: string\n}',
        {
          type: 'object',
          properties: { p: { $ref: '#/definitions/Pet' } },
          definitions: { Pet: { type: 'object' } },
        },
        'Root',
      ),
    );

    expect(error.name).toBe('GeneratedNameEscapeError');
    expect(error.message).toContain('but never "Root"');
  });

  /**
   * A `$ref` sitting in EXAMPLE DATA is not a schema reference and must not
   * create an obligation — `collectRefSites` is blind, so without the
   * position-aware obligation walk this fixture aborts on a pointer that names
   * nothing.
   */
  it('creates no obligation from a $ref that sits in example data', () => {
    expect(() =>
      assertEmittedNamesWereIssued(
        'export interface Root {}',
        {
          type: 'object',
          examples: [{ $ref: '#/definitions/NotReallyAPointer' }],
          default: { $ref: '#/definitions/AlsoNotAPointer' },
        },
        'Root',
      ),
    ).not.toThrow();
  });
});

/**
 * Round 5, the cross-`compile()` half. `assertEmittedNamesWereIssued` sees one
 * `compile()` output at a time and structurally cannot notice that two of them
 * declared the same identifier with different bodies. `DeclarationSet` is where
 * every declaration in the surface is in hand, so that is where the check
 * belongs — and unlike a model of the library's namer, it is a property of the
 * emitted FILE: two different texts declaring one identifier is a duplicate
 * identifier in the committed `.d.ts`, whatever produced it.
 */
describe('DeclarationSet rejects one identifier with two bodies', () => {
  it('accepts the same declaration arriving from several compiles', () => {
    const set = new DeclarationSet();
    const pet = 'export interface Pet {\n  petName?: string\n}';

    set.add(pet);
    set.add(pet);

    expect(set.toSortedArray()).toEqual([pet]);
  });

  it('aborts when two different bodies claim one identifier', () => {
    const set = new DeclarationSet();

    set.add('export interface Owner {\n  petName?: string\n}');

    expect(() =>
      set.add('export interface Owner {\n  ownerName?: string\n}'),
    ).toThrow(/Owner/);
  });

  it('leaves unrecognised declaration shapes alone', () => {
    const set = new DeclarationSet();

    expect(() => {
      set.add('// just a comment');
      set.add('// another comment');
    }).not.toThrow();
  });
});

/**
 * Round 5. `stripTypeDirectivesInPlace` runs on the site clone BEFORE
 * `applyDefinitionNames`, and `applyDefinitionNames` then OVERWRITES every
 * `$defs` entry with a representative body captured off the untouched format —
 * so the strip was undone for exactly the definitions it mattered most for.
 *
 * `tsType` "supercedes all other directives", so a description that sets it
 * retypes a property with NO diagnostic: the file compiles, and the alias points
 * at whatever the description named. `tsEnumNames` is caught loudly by the
 * postcondition because it mints an identifier; `tsType` mints none, which is
 * why this one has to be closed at the substitution rather than by the net.
 *
 * It crosses transactions too: `definitionIdentity` strips the directives, so a
 * clean `Pet` in transaction B is emitted from transaction A's poisoned
 * representative.
 */
describe('a representative body carries no type directives', () => {
  const poisoned = {
    type: 'object',
    properties: { n: { type: 'string', tsType: 'Owner' } },
  };

  it('strips the directives out of the substituted definition', () => {
    const registry = new NameRegistry();
    const format = { $defs: { Pet: structuredClone(poisoned) } };
    const assignment = assignDefinitionNames([format], registry);

    applyDefinitionNames(format, assignment);

    expect(JSON.stringify(format.$defs.Pet)).not.toContain('tsType');
  });

  it('does not let one transaction poison another that is clean', () => {
    const registry = new NameRegistry();
    const dirty = { $defs: { Pet: structuredClone(poisoned) } };
    const clean = {
      $defs: {
        Pet: { type: 'object', properties: { n: { type: 'string' } } },
      },
    };
    const assignment = assignDefinitionNames([dirty, clean], registry);

    applyDefinitionNames(clean, assignment);

    expect(JSON.stringify(clean.$defs.Pet)).not.toContain('tsType');
  });
});

/**
 * Round 5. `example-reflection.ts` emits the LIBRARY TYPE `Record<string, never>`
 * for an empty object example, so `Record` is a name the surface depends on
 * resolving to the global. A `components/schemas` entry called `Record` — which
 * `plugin-openapi` hoists verbatim — declared `export interface Record` and
 * shadowed it, turning every reflected empty object into `TS2315: Type 'Record'
 * is not generic`. Same class as the `Status`/`Selector` reservation already
 * here, and missed for the same reason: the reserved list was built from the
 * aliases this module writes, not from every name the emitted FILE depends on.
 */
describe('names the emitted file depends on are reserved', () => {
  it('does not let a schema called Record shadow the global', () => {
    const registry = new NameRegistry();

    registry.reserve(['Endpoints', 'Record']);

    expect(registry.assign('defs:Record', 'Record')).not.toBe('Record');
  });
});

/**
 * The reservation above only helps if the SURFACE actually performs it, so this
 * asserts the production list rather than the registry mechanism — a mutation
 * dropping `'Record'` from `generate-request-types-surface.ts` has to fail
 * something, and the registry-level test would happily pass without it.
 */
describe('the surface reserves every name the emitted file depends on', () => {
  it('reserves Record alongside the aliases', async () => {
    const source = await readFile(
      new URL(
        '../src/generation/types/generate-request-types-surface.ts',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toMatch(
      /registry\.reserve\(\[\.\.\.Object\.values\(ALIAS\), 'Record'\]\)/,
    );
  });
});

/**
 * Round 5's verdict on `extends`, and it reversed round 4's.
 *
 * Round 4 left `extends` outside the name strip and let the postcondition abort
 * on a `title` there. That turned a description which COMPILED CORRECTLY into a
 * hard failure: measured, `extends: [{title: 'Owner', …}]` emits
 * `interface Root extends Owner` plus a correctly-bodied `interface Owner`,
 * `tsc`-clean. Rounds 1-3 each turned a SILENTLY WRONG file into a loud abort;
 * this one turned a RIGHT file into an abort, which is not the same trade.
 *
 * The reviewer's remedy — delete `extends` at the compile boundary — was tested
 * and rejected: it drops the super-type's members from the emitted type with no
 * diagnostic at all, so a hook author silently loses `h`. Trading a working file
 * for silent data loss is worse than the abort it replaces.
 *
 * Folding `extends` into `allOf` is what survived. `allOf` IS a position the
 * strip walks, so the name is removed rather than declared; the members are
 * preserved; and nothing aborts. Draft-03 `extends` and `allOf` mean the same
 * thing, so this is a spelling change, not a semantic one.
 */
describe('a super-type is folded into allOf, not left to name itself', () => {
  const withSuperType = {
    type: 'object',
    properties: { a: { type: 'string' } },
    extends: [
      {
        title: 'Owner',
        type: 'object',
        properties: { h: { type: 'string' } },
      },
    ],
  };

  it('keeps the super-type members and declares nothing for its title', async () => {
    const generated = await generateTypeForSchema(
      structuredClone(withSuperType),
      'application/json',
      'GetPets200ResponseBody',
    );
    const text = generated.declarations.join('\n');

    expect(text).toContain('h?: string');
    expect(text).toContain('a?: string');
    expect(
      generated.declarations
        .flatMap((declaration) => splitDeclarations(declaration))
        .map(identifierOf),
    ).toEqual(['GetPets200ResponseBody']);
  });

  it('folds a nested super-type too', () => {
    const schema = {
      type: 'object',
      properties: {
        inner: {
          type: 'object',
          extends: [{ title: 'Deep', type: 'object', properties: {} }],
        },
      },
    };

    foldExtendsInPlace(schema);

    expect(JSON.stringify(schema)).not.toContain('extends');
    expect(JSON.stringify(schema)).toContain('allOf');
  });

  it('appends to an allOf that is already there', () => {
    const schema = {
      allOf: [{ type: 'object', properties: { first: { type: 'string' } } }],
      extends: { type: 'object', properties: { second: { type: 'string' } } },
    };

    foldExtendsInPlace(schema);

    expect((schema as { allOf: unknown[] }).allOf).toHaveLength(2);
  });

  it('leaves an extends that is not a schema alone', () => {
    const schema = { extends: 'not-a-schema' };

    expect(() => foldExtendsInPlace(schema)).not.toThrow();
    expect(schema.extends).toBe('not-a-schema');
  });
});
