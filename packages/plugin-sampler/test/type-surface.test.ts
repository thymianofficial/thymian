import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { generateTypeSurface } from '../src/generation/types/generate-type-surface.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { checkSurface, compileHook } from './compile-probe.js';

/**
 * A description with a body carrying examples at three levels: a primitive
 * property, an object example, and an array whose elements have their own.
 */
function formatWithExamples(
  options: {
    description?: string;
    reversed?: boolean;
  } = {},
): ThymianFormat {
  const format = new ThymianFormat();
  const astronaut = {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', examples: ['a1', 'a2'] },
      rank: { type: 'string', enum: ['commander', 'pilot'] },
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            year: { type: 'integer' },
          },
        },
        examples: [[{ name: 'Apollo', year: 1969 }]],
      },
      crew: {
        type: 'object',
        properties: { lead: { type: 'string' }, size: { type: 'integer' } },
        examples: [{ lead: 'Sarah', size: 3 }],
      },
    },
  };

  const pairs: Array<
    [
      ReturnType<typeof createHttpRequest>,
      ReturnType<typeof createHttpResponse>,
    ]
  > = [
    [
      createHttpRequest({
        method: 'POST',
        path: '/astronauts',
        mediaType: 'application/json',
        bodyRequired: true,
        body: astronaut as never,
        description: options.description,
      }),
      createHttpResponse({
        statusCode: 201,
        mediaType: 'application/json',
        schema: astronaut as never,
        description: options.description,
      }),
    ],
    [
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    ],
  ];

  for (const [req, res] of options.reversed ? [...pairs].reverse() : pairs) {
    format.addHttpTransaction(req, res, 'test-source');
  }

  return format;
}

function catalogOf(format: ThymianFormat): TransactionCatalog {
  return TransactionCatalog.fromThymianFormat(format);
}

const CREATE = 'POST /astronauts (application/json) -> 201 (application/json)';

describe('the committed type surface', () => {
  describe('determinism', () => {
    it('is byte-identical across repeated generation', async () => {
      const catalog = catalogOf(formatWithExamples());

      expect(await generateTypeSurface(catalog)).toEqual(
        await generateTypeSurface(catalog),
      );
    });

    it('is byte-identical across a format export/import round trip', async () => {
      const format = formatWithExamples();
      const direct = await generateTypeSurface(catalogOf(format));
      const roundTripped = await generateTypeSurface(
        catalogOf(ThymianFormat.import(format.export())),
      );

      expect(roundTripped).toEqual(direct);
    });

    it('is unchanged by a description-only edit', async () => {
      const plain = await generateTypeSurface(catalogOf(formatWithExamples()));
      const described = await generateTypeSurface(
        catalogOf(formatWithExamples({ description: 'Creates an astronaut.' })),
      );

      expect(described).toEqual(plain);
    });

    it('is unchanged by reordering the source document', async () => {
      const forward = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );
      const reversed = await generateTypeSurface(
        catalogOf(formatWithExamples({ reversed: true })),
      );

      expect(reversed).toEqual(forward);
    });
  });

  describe('spec-derived unions', () => {
    it('emits each one sorted, from the description alone', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      expect(requestTypes).toContain('export type Method = "GET" | "POST";');
      expect(requestTypes).toContain('export type Status = 200 | 201;');
      expect(requestTypes).toContain('export type StatusClass = "2XX";');
      expect(requestTypes).toContain(
        'export type Path = "/astronauts" | "/launches";',
      );
      expect(requestTypes).toContain(
        'export type RequestMediaType = "application/json";',
      );
    });

    it('keys Endpoints by selector, in catalog order', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );
      const keys = [...requestTypes.matchAll(/^ {2}"(.+?)": \{$/gm)].map(
        (match) => match[1],
      );

      expect(keys).toEqual([...keys].sort());
      expect(keys).toContain(CREATE);
    });
  });

  describe('examples on named component schemas', () => {
    /**
     * The same schema twice: once inline, once behind a `$ref` into `$defs`.
     * Named components are how essentially every real description is written,
     * so a reflection that only reaches inline schemas is off for most users.
     *
     * Asserted on the **emitted artifact** rather than on `reflectExamples` in
     * isolation, because a unit test over inline schemas is exactly what let
     * this through.
     */
    function withComponents(): TransactionCatalog {
      const format = new ThymianFormat();
      const launch = {
        type: 'object',
        properties: {
          name: { type: 'string', examples: ['Artemis I', 'Apollo 11'] },
        },
      };

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/inline' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: launch as never,
        }),
        'test-source',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/viaref' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: {
            $defs: { Launch: launch },
            $ref: '#/$defs/Launch',
          } as never,
        }),
        'test-source',
      );

      return TransactionCatalog.fromThymianFormat(format);
    }

    it('reflects an example declared on a $ref-d component', async () => {
      const { requestTypes } = await generateTypeSurface(withComponents());
      const reflected = [...requestTypes.matchAll(/name\?: (.+)$/gm)].map(
        (match) => match[1],
      );

      // Both operations, not just the inline one.
      expect(reflected).toHaveLength(2);
      for (const type of reflected) {
        expect(type).toBe('"Artemis I" | "Apollo 11" | (string & {})');
      }
    });

    it('does not push a referring site’s example into the shared component', async () => {
      const format = new ThymianFormat();
      const shared = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/two-users' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: {
            type: 'object',
            $defs: { Crew: shared },
            properties: {
              // An example beside a `$ref` describes *this* property, not the
              // component every other property shares.
              lead: { $ref: '#/$defs/Crew', examples: [{ name: 'Sarah' }] },
              backup: { $ref: '#/$defs/Crew' },
            },
          } as never,
        }),
        'test-source',
      );

      const { requestTypes } = await generateTypeSurface(
        TransactionCatalog.fromThymianFormat(format),
      );

      // `backup` shares the component, so leaking "Sarah" into it would be a
      // lie about the API.
      expect(requestTypes).not.toContain('"Sarah"');
    });

    it('reflects through allOf, anyOf and oneOf', async () => {
      const format = new ThymianFormat();

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/composed' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: {
            allOf: [
              {
                type: 'object',
                properties: {
                  rank: { type: 'string', examples: ['Commander'] },
                },
              },
            ],
          } as never,
        }),
        'test-source',
      );

      const { requestTypes } = await generateTypeSurface(
        TransactionCatalog.fromThymianFormat(format),
      );

      expect(requestTypes).toContain('"Commander" | (string & {})');
    });
  });

  describe('what the surface imports', () => {
    it('imports the other generated file by its module path', async () => {
      const { hooksApi } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      // A `.d.ts` file is imported by the module path it declares, not by its
      // own filename. `./request-types.d.ts` happened to resolve under the
      // scaffolded tsconfig, which is exactly why it needs pinning.
      expect(hooksApi).toContain("from './request-types.js'");
      expect(hooksApi).not.toContain('request-types.d.ts');
    });
  });

  describe('example reflection', () => {
    it('reflects a primitive property as an open literal union', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      expect(requestTypes).toContain('"a1" | "a2" | (string & {})');
    });

    it('pushes an object example down into its properties', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      // The object example became property examples, one level down…
      expect(requestTypes).toContain('"Sarah" | (string & {})');
      expect(requestTypes).toContain('3 | (number & {})');
      // …and an array example became element-property examples.
      expect(requestTypes).toContain('"Apollo" | (string & {})');
      expect(requestTypes).toContain('1969 | (number & {})');
    });

    it('never emits an object as a union of example-shaped object types', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      // The shape that broke mutate-in-place hooks: `{...} | {...}`. A union of
      // closed object types makes TypeScript check a property write against the
      // intersection of the members, so ordinary mutation stops compiling.
      expect(requestTypes).not.toMatch(/\}\s*\|\s*\{/);
    });

    it('leaves an enum closed', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatWithExamples()),
      );

      expect(requestTypes).toContain('"commander" | "pilot"');
      expect(requestTypes).not.toContain(
        '"commander" | "pilot" | (string & {})',
      );
    });
  });

  /**
   * The mandatory probes. Whether a body stays mutable is a question only the
   * compiler can answer, and text assertions are exactly what let the earlier
   * object-union reflection ship.
   */
  describe('declaration names', () => {
    /** A description of `count` numbered endpoints, plus whatever `extra` adds. */
    function formatOf(
      paths: readonly string[],
      options: { readonly parameter?: string } = {},
    ): ThymianFormat {
      const format = new ThymianFormat();

      for (const path of paths) {
        format.addHttpTransaction(
          createHttpRequest({
            method: 'GET',
            path,
            queryParameters: options.parameter
              ? {
                  [options.parameter]: {
                    name: options.parameter,
                    in: 'query',
                    required: false,
                    schema: { type: 'integer' } as never,
                  },
                }
              : {},
          }),
          createHttpResponse({
            statusCode: 200,
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: { a: { type: 'string' } },
            } as never,
          }),
          'test-source',
        );
      }

      return format;
    }

    it('names a declaration after its selector and role', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(formatOf(['/launches'], { parameter: 'limit' })),
      );

      expect(requestTypes).toContain(
        'GetLaunches200ApplicationJsonResponseBody',
      );
      expect(requestTypes).toContain(
        'GetLaunches200ApplicationJsonQueryParam_Limit',
      );
      expect(requestTypes).not.toMatch(/Transaction\d+Type\d+/);
    });

    it('leaves every other endpoint alone when one is inserted', async () => {
      const before = await generateTypeSurface(
        catalogOf(formatOf(['/b', '/c'])),
      );
      // `/a` sorts first, so a positional name would renumber `/b` and `/c`.
      const after = await generateTypeSurface(
        catalogOf(formatOf(['/a', '/b', '/c'])),
      );

      const added = after.requestTypes
        .split('\n')
        .filter((line) => !before.requestTypes.includes(line));
      const removed = before.requestTypes
        .split('\n')
        .filter((line) => !after.requestTypes.includes(line));

      // Exhaustively: the only lines that move are the new endpoint's own —
      // its declaration, its selector key, its path and the reference to its
      // body — plus the one union it widens.
      expect(removed).toEqual(['export type Path = "/b" | "/c";']);
      expect([...added].sort()).toEqual(
        [
          'export interface GetA200ApplicationJsonResponseBody {',
          '  "GET /a -> 200 (application/json)": {',
          '    path: "/a";',
          '      body: GetA200ApplicationJsonResponseBody;',
          'export type Path = "/a" | "/b" | "/c";',
        ].sort(),
      );
    });

    it('separates two selectors that sanitise onto one identifier', async () => {
      const format = new ThymianFormat();

      // `A-B` and `A.B` both pascal-case to `Ab`, so the stems collide.
      for (const method of ['A-B', 'A.B']) {
        format.addHttpTransaction(
          createHttpRequest({ method, path: '/x' }),
          createHttpResponse({
            statusCode: 200,
            mediaType: 'application/json',
            schema: { type: 'object' } as never,
          }),
          'test-source',
        );
      }

      const { requestTypes } = await generateTypeSurface(catalogOf(format));

      // Both stems are `ABX200ApplicationJson`, so the second claimant is
      // suffixed rather than silently sharing the first one's declaration.
      expect(requestTypes).toContain(
        'export interface ABX200ApplicationJsonResponseBody {',
      );
      expect(requestTypes).toContain(
        'export interface ABX200ApplicationJsonResponseBody_2 {',
      );
    });

    it('declares under the name it references when a schema has a title', async () => {
      // `title` outranks the name handed to `compile()`, so before the strip
      // this emitted `export interface Nasa` and referenced a name that was
      // never declared — a committed surface that does not compile.
      const format = new ThymianFormat();

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/x' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: {
            title: 'Nasa',
            $id: 'https://example.test/nasa',
            id: 'https://example.test/legacy',
            type: 'object',
            properties: { a: { type: 'string' } },
          } as never,
        }),
        'test-source',
      );

      const { requestTypes } = await generateTypeSurface(catalogOf(format));

      expect(requestTypes).toContain(
        'export interface GetX200ApplicationJsonResponseBody {',
      );
      expect(requestTypes).not.toContain('Nasa');
    });
  });

  describe('one declaration per component', () => {
    /** `count` transactions, each referencing the same named component. */
    function sharing(component: object, count: number): ThymianFormat {
      const format = new ThymianFormat();

      for (let index = 0; index < count; index += 1) {
        format.addHttpTransaction(
          createHttpRequest({ method: 'GET', path: `/p${index}` }),
          createHttpResponse({
            statusCode: 200,
            mediaType: 'application/json',
            schema: {
              $defs: { Shared: component },
              type: 'object',
              properties: { shared: { $ref: '#/$defs/Shared' } },
            } as never,
          }),
          'test-source',
        );
      }

      return format;
    }

    it('emits a shared interface once, not once per reference', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(
          sharing({ type: 'object', properties: { a: { type: 'string' } } }, 4),
        ),
      );

      expect(requestTypes.match(/^export interface Shared \{/gm)).toHaveLength(
        1,
      );
    });

    it('compiles when the shared component is a type alias', async () => {
      // An interface duplicated four times merges, so the duplication was
      // invisible; a type alias duplicated four times is TS2300 four times.
      const catalog = catalogOf(
        sharing({ type: 'string', enum: ['commander', 'pilot'] }, 4),
      );
      const { requestTypes } = await generateTypeSurface(catalog);

      expect(requestTypes.match(/^export type Shared =/gm)).toHaveLength(1);
      expect(await checkSurface(catalog)).toEqual([]);
    });

    it('keeps two same-named components apart when they differ', async () => {
      // Two description files may each declare their own `Shared`. Merging
      // them would give one root the other's body.
      const format = new ThymianFormat();

      for (const [index, type] of ['string', 'integer'].entries()) {
        format.addHttpTransaction(
          createHttpRequest({ method: 'GET', path: `/p${index}` }),
          createHttpResponse({
            statusCode: 200,
            mediaType: 'application/json',
            schema: {
              $defs: { Shared: { type } },
              type: 'object',
              properties: { shared: { $ref: '#/$defs/Shared' } },
            } as never,
          }),
          `source-${index}`,
        );
      }

      const catalog = catalogOf(format);
      const { requestTypes } = await generateTypeSurface(catalog);

      expect(requestTypes).toContain('export type Shared = string');
      expect(requestTypes).toContain('export type Shared_2 = number');
      expect(await checkSurface(catalog)).toEqual([]);
    });

    it('emits a closed object as one, not as an unsatisfiable index', async () => {
      // `additionalProperties: false` arrives as `{ not: {} }`, and read as a
      // value schema it became `[k: string]: { [k: string]: unknown }` — an
      // index signature the declared property could not satisfy.
      const format = new ThymianFormat();

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/x' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: {
            type: 'object',
            additionalProperties: { not: {} },
            required: ['count'],
            properties: { count: { type: 'integer' } },
          } as never,
        }),
        'test-source',
      );

      const catalog = catalogOf(format);
      const { requestTypes } = await generateTypeSurface(catalog);

      expect(requestTypes).toContain('count: number');
      expect(requestTypes).not.toContain('[k: string]: {');
      expect(await checkSurface(catalog)).toEqual([]);
    });

    it('produces a surface that typechecks without skipLibCheck', async () => {
      expect(await checkSurface(catalogOf(formatWithExamples()))).toEqual([]);
    });
  });

  describe('example reflection hardening', () => {
    /** One transaction whose response body is `schema`. */
    function responding(schema: object): ThymianFormat {
      const format = new ThymianFormat();

      format.addHttpTransaction(
        createHttpRequest({ method: 'GET', path: '/x' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          schema: schema as never,
        }),
        'test-source',
      );

      return format;
    }

    it('is unchanged by reordering $defs', async () => {
      const defs = {
        Alpha: { type: 'string', examples: ['a'] },
        Beta: { type: 'integer', examples: [1] },
      };
      const body = (order: readonly string[]) => ({
        $defs: Object.fromEntries(
          order.map((name) => [name, defs[name as keyof typeof defs]]),
        ),
        type: 'object',
        properties: {
          alpha: { $ref: '#/$defs/Alpha' },
          beta: { $ref: '#/$defs/Beta' },
        },
      });

      expect(
        await generateTypeSurface(
          catalogOf(responding(body(['Beta', 'Alpha']))),
        ),
      ).toEqual(
        await generateTypeSurface(
          catalogOf(responding(body(['Alpha', 'Beta']))),
        ),
      );
    });

    it('reflects a component once, however many sites refer to it', async () => {
      const catalog = catalogOf(
        responding({
          $defs: { Rank: { type: 'string', examples: ['commander'] } },
          type: 'object',
          properties: {
            // One site carries its own example beside the `$ref`, the other
            // does not. Neither may change the component.
            lead: { $ref: '#/$defs/Rank', examples: ['pilot'] },
            backup: { $ref: '#/$defs/Rank' },
          },
        }),
      );
      const { requestTypes } = await generateTypeSurface(catalog);

      expect(requestTypes.match(/^export type Rank =/gm)).toHaveLength(1);
      expect(requestTypes).toContain(
        'export type Rank = "commander" | (string & {})',
      );
      expect(requestTypes).not.toContain('"pilot"');
      expect(await checkSurface(catalog)).toEqual([]);
    });

    it('never emits {} for an empty object example', async () => {
      // TypeScript's `{}` is "anything but null and undefined": it absorbs the
      // base type and every diagnostic with it.
      const catalog = catalogOf(
        responding({
          type: 'object',
          properties: {
            crew: {
              type: 'object',
              examples: [{}],
              properties: { lead: { type: 'string' } },
            },
          },
        }),
      );
      const { requestTypes } = await generateTypeSurface(catalog);

      expect(requestTypes).not.toMatch(/:\s*\{\}/);

      const diagnostics = await compileHook(
        catalog,
        `import { afterEach } from '@thymian/hooks';

export const check = afterEach('GET /x -> 200 (application/json)', (_, response) => {
  const crew: number = response.body.crew!;
});
`,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toContain('const crew: number');
    });

    it('drops an example the declared type does not admit', async () => {
      const { requestTypes } = await generateTypeSurface(
        catalogOf(
          responding({
            type: 'object',
            properties: {
              count: { type: 'integer', examples: ['not-a-number', 3] },
            },
          }),
        ),
      );

      expect(requestTypes).toContain('count?: 3 | (number & {})');
      expect(requestTypes).not.toContain('not-a-number');
    });
  });

  describe('compile seam', () => {
    it('lets a hook write to every property of an example-reflected body', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(CREATE)}, (request) => {
  const body = request.body!;

  body.id = 'a1';
  body.id = 'anything-else';
  body.rank = 'pilot';
  body.crew = { lead: 'Sarah', size: 3 };
  body.crew!.lead = 'someone-else';
  body.missions = [{ name: 'Artemis', year: 2026 }];
  body.missions![0]!.year = 2030;
});
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('rejects a value the enum does not allow, at that line', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(CREATE)}, (request) => {
  request.body!.rank = 'stowaway';
});
`,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe("request.body!.rank = 'stowaway';");
    });

    it('rejects a dead selector at the hook’s own line', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const alive = beforeEach(${JSON.stringify(CREATE)}, () => {});

export const dead = beforeEach(
  'POST /astronauts (application/json) -> 418 (application/json)',
  () => {},
);
`,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.line).toBe(6);
    });

    it('rejects a stale filter value, and a wildcard-free path that is not a Path', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const staleStatus = beforeEach({ status: 418 }, () => {});

export const staleMethod = beforeEach({ method: 'PATCH' }, () => {});

export const typoPath = beforeEach({ path: '/astronaut' }, () => {});

export const glob = beforeEach({ path: '/astronauts/**' }, () => {});
`,
      );

      expect(diagnostics.map((d) => d.line)).toEqual([3, 5, 7]);
    });

    it('accepts a filter with a not clause and a glob inside it', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const broadcast = beforeEach(
  { path: '/**', not: { statusClass: '2XX' } },
  () => {},
);
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('does not make a required body need a non-null assertion', async () => {
      // The fixture's POST body is `bodyRequired`, so the description says the
      // body is always there. Declaring the field optional anyway made every
      // body-touching hook write `draft.body!`.
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { defineSample } from '@thymian/hooks';

export const shape = defineSample(${JSON.stringify(CREATE)}, (draft) => {
  draft.body.id = 'a1';
  draft.body.rank = 'pilot';
});
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('keeps the body optional where the transaction has none', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { defineSample } from '@thymian/hooks';

export const shape = defineSample(
  'GET /launches -> 200 (application/json)',
  (draft) => {
    // No body is declared for this Transaction, so reading it unguarded is
    // exactly the mistake the optional field exists to catch.
    draft.body.anything = 1;
  },
);
`,
      );

      // Caught, whichever way the compiler words it — the point is that a
      // Transaction with no declared body does not promise one.
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('draft.body.anything = 1;');
    });

    it('accepts the seeding idiom the docs teach', async () => {
      // Typing `args` as the full `req` made every one of these a compile
      // error for an operation with a required body — which is the only kind
      // anyone seeds with. `args` overlays the generated request, so each
      // group is a Partial and the body is optional.
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(CREATE)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE)}, {}, { authorize: true });
  await utils.request(${JSON.stringify(CREATE)});
  await utils.request(${JSON.stringify(CREATE)}, { headers: { 'x-a': 'b' } });
  await utils.request(${JSON.stringify(CREATE)}, { body: { id: 'a1' } });
});
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('types the request the way the request actually is', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(CREATE)}, (request) => {
  // The path is the template, and assigning it is legitimate.
  request.path = '/astronauts';
  // Parameters live in their own groups.
  request.pathParameters['id'] = 1;
  request.query['limit'] = 3;
  request.headers['x-trace'] = 'yes';
  request.cookies['session'] = 'abc';
  request.authorize = true;
});
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('rejects treating the path template as a parameter bag', async () => {
      // This used to compile and then throw `Cannot create property 'id' on
      // string` at run time — the compiler blessing the crash.
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const wrong = beforeEach(${JSON.stringify(CREATE)}, (request) => {
  request.path.id = 'abc';
});
`,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.line).toBe(4);
    });

    it('types the method with the casing a hook actually receives', async () => {
      // Emitting the uppercase form made `request.method === 'post'` a compile
      // error and `=== 'POST'` a comparison that is always false at run time,
      // because the value is the description's own path-item key.
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const branch = beforeEach(${JSON.stringify(CREATE)}, (request, ctx, utils) => {
  if (request.method === 'POST') {
    utils.info('a POST');
  }
});
`,
      );

      expect(diagnostics).toEqual([]);
    });

    it('types utils.request by the selector it is given', async () => {
      const diagnostics = await compileHook(
        catalogOf(formatWithExamples()),
        `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(CREATE)}, async (request, ctx, utils) => {
  const created = await utils.request(${JSON.stringify(CREATE)});
  const id: string = created.body!.id;

  request.headers['x-seeded'] = id;
  await utils.request('POST /astronauts (application/json) -> 418 (application/json)');
});
`,
      );

      // Only the dead selector is wrong; the typed body read is fine.
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toContain('418');
    });
  });
});
