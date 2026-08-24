import { toSafeString } from 'json-schema-to-typescript/dist/src/utils.js';
import { describe, expect, it } from 'vitest';

import { identifierOf } from '../src/generation/types/declaration-set.js';
import {
  applyDefinitionNames,
  assignDefinitionNames,
  canonicalJson,
  type DefinitionNameAssignment,
} from '../src/generation/types/schema-definitions.js';
import {
  assignUniqueNames,
  NameRegistry,
  safeIdentifier,
} from '../src/generation/types/type-names.js';
import { generateTypeForSchema } from '../src/hooks/generate-request-types.js';

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
      ['A', new Map([[canonicalJson(a), 'Same']])],
      ['B', new Map([[canonicalJson(b), 'Same']])],
    ]);

    expect(() => applyDefinitionNames(schema, assignment)).toThrow(
      /would both be emitted as "Same"/,
    );
  });
});
