import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { generateTypeSurface } from '../src/generation/types/generate-type-surface.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { compileHook } from './compile-probe.js';

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
