import { toSafeString } from 'json-schema-to-typescript/dist/src/utils.js';
import { describe, expect, it } from 'vitest';

import {
  candidateName,
  NameRegistry,
  pascalSegments,
  safeIdentifier,
} from '../src/generation/types/type-names.js';

/**
 * Names that reach the sanitiser from a real description rather than from
 * paranoia: `req.path` values like `/v1beta/…` and `/oauth2token` come straight
 * out of `plugin-openapi`, `2fa` is an ordinary query-parameter name, `400` is
 * an ordinary component key, and a control character reaches a header name
 * because nothing in the selector grammar forbids it.
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

describe('pascalSegments', () => {
  it('folds a run of unusable characters into one word boundary', () => {
    expect(pascalSegments('GET /astronauts/{id} -> 200')).toBe(
      'GetAstronautsId200',
    );
    expect(pascalSegments('application/vnd.Example+JSON')).toBe(
      'ApplicationVndExampleJson',
    );
  });

  it('has nothing to say about a name with no usable characters', () => {
    expect(pascalSegments('---')).toBe('');
  });
});

describe('candidateName', () => {
  it('is a valid identifier for every role, on a hostile selector', () => {
    const selector = '400 /  -> 200';

    for (const role of [
      { kind: 'request-body' },
      { kind: 'response-body' },
      { kind: 'query-parameter', parameter: '2fa' },
      { kind: 'path-parameter', parameter: '' },
      { kind: 'request-header', parameter: 'x\rbad' },
      { kind: 'cookie', parameter: '-' },
      { kind: 'response-header', parameter: 'content-type' },
    ] as const) {
      const name = candidateName(selector, role);

      expect(name, `${role.kind}`).toMatch(IDENTIFIER);
      expect(toSafeString(name), `${role.kind}`).toBe(name);
    }
  });

  it('gives a parameter that sanitises to nothing a name of its own', () => {
    // Otherwise `Header_` would merge with the next empty-ish one.
    expect(
      candidateName('GET /x -> 200', { kind: 'cookie', parameter: '-' }),
    ).toContain('Cookie_Unnamed');
  });

  it('separates two roles that differ only in their parameter', () => {
    const query = candidateName('GET /x -> 200', {
      kind: 'query-parameter',
      parameter: 'limit',
    });
    const header = candidateName('GET /x -> 200', {
      kind: 'request-header',
      parameter: 'limit',
    });

    expect(query).not.toBe(header);
  });
});

describe('NameRegistry', () => {
  it('returns one name per site, however often it is asked', () => {
    const registry = new NameRegistry();
    const first = registry.nameFor('GET /x -> 200', { kind: 'request-body' });

    expect(registry.nameFor('GET /x -> 200', { kind: 'request-body' })).toBe(
      first,
    );
  });

  it('never hands out a reserved name', () => {
    const registry = new NameRegistry(['GetX200RequestBody']);

    expect(registry.nameFor('GET /x -> 200', { kind: 'request-body' })).toBe(
      'GetX200RequestBody_2',
    );
  });

  it('separates two selectors that sanitise onto one candidate', () => {
    const registry = new NameRegistry();
    const first = registry.nameFor('A-B /x -> 200', { kind: 'request-body' });
    const second = registry.nameFor('A.B /x -> 200', { kind: 'request-body' });

    expect(second).not.toBe(first);
    expect(second).toBe(`${first}_2`);
  });

  it('keeps a site that wants the suffixed name distinct from both', () => {
    const registry = new NameRegistry();
    const names = [
      registry.nameFor('A-B /x -> 200', { kind: 'request-body' }),
      registry.nameFor('A.B /x -> 200', { kind: 'request-body' }),
      registry.nameFor('A B /x -> 200', { kind: 'request-body' }),
    ];

    expect(new Set(names).size).toBe(3);
  });
});
