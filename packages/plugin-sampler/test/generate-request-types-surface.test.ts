import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  type Parameter,
  type ThymianError,
  ThymianFormat,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianSchema,
} from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { Project, type SourceFile, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { generateRequestTypesSurface } from '../src/generation/types/generate-request-types-surface.js';
import {
  parseSelector,
  selectorForTransaction,
  selectorPath,
} from '../src/selectors/selector.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';

// ts-morph pulls in the full TS compiler; its cold import can exceed 10s on slow
// runners, so every case that compiles the surface gets headroom.
const COMPILE_TIMEOUT = { timeout: 30_000 };

type TransactionSpec = {
  method?: string;
  path?: string;
  requestMediaType?: string;
  status?: number;
  responseMediaType?: string;
  host?: string;
  protocol?: 'http' | 'https';
  source?: string;
  requestBody?: ThymianSchema;
  responseSchema?: ThymianSchema;
  queryParameters?: Record<string, Parameter>;
  pathParameters?: Record<string, Parameter>;
  headers?: Record<string, Parameter>;
  cookies?: Record<string, Parameter>;
  responseHeaders?: Record<string, Parameter>;
};

/**
 * Hand-builds a format from explicit literals, modelled on
 * `test/selectors/transaction-catalog.test.ts:74`.
 * `createThymianFormatWithTransactions` cannot express media variants, differing
 * hosts, schemas or parameters, which is what almost every case here is about.
 *
 * The response is assembled by spreading over `createHttpResponse` rather than
 * through it, because the factory coerces a falsy `statusCode` to `200`
 * (`http-response.factory.ts:22`) and the out-of-range-status cases need a
 * literal `0`.
 */
function formatFrom(specs: readonly TransactionSpec[]): ThymianFormat {
  const format = new ThymianFormat();

  for (const spec of specs) {
    const source = spec.source ?? 'test-source';
    const request: ThymianHttpRequest = createHttpRequest({
      method: spec.method ?? 'GET',
      path: spec.path ?? '/launches',
      host: spec.host ?? 'localhost',
      port: 8080,
      protocol: spec.protocol ?? 'http',
      mediaType: spec.requestMediaType ?? '',
      sourceName: source,
      ...(spec.requestBody ? { body: spec.requestBody } : {}),
      ...(spec.queryParameters
        ? { queryParameters: spec.queryParameters }
        : {}),
      ...(spec.pathParameters ? { pathParameters: spec.pathParameters } : {}),
      ...(spec.headers ? { headers: spec.headers } : {}),
      ...(spec.cookies ? { cookies: spec.cookies } : {}),
    });
    const response: ThymianHttpResponse = {
      ...createHttpResponse({ sourceName: source }),
      statusCode: spec.status ?? 200,
      mediaType: spec.responseMediaType ?? '',
      headers: spec.responseHeaders ?? {},
      ...(spec.responseSchema ? { schema: spec.responseSchema } : {}),
    };

    format.addHttpTransaction(request, response, source);
  }

  return format;
}

function param(schema: ThymianSchema, required = false): Parameter {
  return { schema, required, style: { style: 'form', explode: true } };
}

function surfaceOf(specs: readonly TransactionSpec[]): Promise<string> {
  return generateRequestTypesSurface(formatFrom(specs));
}

function catchError(fn: () => unknown): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to throw, but it returned normally.');
}

async function catchAsyncError(
  fn: () => Promise<unknown>,
): Promise<ThymianError> {
  try {
    await fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to reject, but it resolved.');
}

/**
 * Compiles the emitted surface, plus any probe modules, and returns every
 * diagnostic. Asserting on the emitted STRING cannot prove assignability, which
 * is what "the type stays open" and "a stale value is a `tsc` error" are claims
 * about — so those claims are made against the compiler.
 */
function compile(
  surface: string,
  probes: Readonly<Record<string, string>> = {},
): { sourceFile: SourceFile; diagnostics: string[] } {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true },
  });
  const sourceFile = project.createSourceFile('generated.ts', surface);

  for (const [name, text] of Object.entries(probes)) {
    project.createSourceFile(name, text);
  }

  const diagnostics = project
    .getPreEmitDiagnostics()
    .map(
      (diagnostic) =>
        `${diagnostic.getSourceFile()?.getBaseName() ?? '?'}:${diagnostic.getCode()} ${project.formatDiagnosticsWithColorAndContext([diagnostic])}`,
    );

  return { sourceFile, diagnostics };
}

function parse(surface: string): SourceFile {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
  }).createSourceFile('generated.ts', surface);
}

/**
 * The emitted `Endpoints` keys, in emitted order.
 *
 * Restricted to the alias's OWN members on purpose: a descendant search also
 * finds the quoted parameter names nested inside each entry (`"content-type"`),
 * which would make every key assertion pass for the wrong reason.
 */
function endpointMembers(surface: string) {
  return (
    parse(surface)
      .getTypeAliasOrThrow('Endpoints')
      .getTypeNodeOrThrow()
      .asKind(SyntaxKind.TypeLiteral)
      ?.getMembers() ?? []
  );
}

function endpointKeys(surface: string): string[] {
  return endpointMembers(surface).flatMap((member) => {
    const name = member
      .asKind(SyntaxKind.PropertySignature)
      ?.getNameNode()
      .asKind(SyntaxKind.StringLiteral);

    return name ? [name.getLiteralValue()] : [];
  });
}

/** A union alias's members, as written. `never` comes back as `['never']`. */
function unionMembers(surface: string, name: string): string[] {
  const text = parse(surface)
    .getTypeAliasOrThrow(name)
    .getTypeNodeOrThrow()
    .getText();

  return text
    .split('|')
    .map((member) => member.trim())
    .filter((member) => member.length > 0);
}

function entryText(surface: string, selector: string): string {
  const member = endpointMembers(surface).find(
    (candidate) =>
      candidate
        .asKind(SyntaxKind.PropertySignature)
        ?.getNameNode()
        .asKind(SyntaxKind.StringLiteral)
        ?.getLiteralValue() === selector,
  );

  expect(member, `no Endpoints entry for ${selector}`).toBeDefined();

  return member?.getText() ?? '';
}

/** Every top-level declaration in the surface, keyed by declared name. */
function declarations(surface: string): Map<string, string> {
  const sourceFile = parse(surface);
  const byName = new Map<string, string>();

  for (const alias of sourceFile.getTypeAliases()) {
    byName.set(alias.getName(), alias.getText());
  }

  for (const declaration of sourceFile.getInterfaces()) {
    byName.set(declaration.getName(), declaration.getText());
  }

  return byName;
}

const SPEC_UNIONS = [
  'Method',
  'Status',
  'StatusClass',
  'Path',
  'RequestMediaType',
  'ResponseMediaType',
] as const;

/**
 * The schema declarations only. `Endpoints` and the unions are expected to
 * change when a transaction is added; the point of AC7 is that the SCHEMA
 * declarations do not.
 */
function schemaDeclarations(surface: string): Map<string, string> {
  const surfaceLevel = new Set<string>([
    'Endpoints',
    'Selector',
    ...SPEC_UNIONS,
  ]);

  return new Map(
    [...declarations(surface)].filter(([name]) => !surfaceLevel.has(name)),
  );
}

describe('generateRequestTypesSurface', () => {
  describe('Endpoints keys (AC1)', () => {
    it('emits one key per catalog entry, in catalog order, verbatim', async () => {
      const specs: TransactionSpec[] = [
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/json',
        },
        {
          method: 'post',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 201,
          responseMediaType: 'application/json',
        },
        { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
      ];
      const format = formatFrom(specs);
      const catalog = TransactionCatalog.fromThymianFormat(format);

      const surface = await generateRequestTypesSurface(format);

      expect(endpointKeys(surface)).toEqual([...catalog.selectors()]);
    });

    it('strips host, port and protocol from every key', async () => {
      const surface = await surfaceOf([
        {
          method: 'GET',
          path: '/launches',
          host: 'api.example.com',
          protocol: 'https',
          status: 200,
        },
      ]);

      expect(endpointKeys(surface)).toEqual(['GET /launches -> 200']);
    });

    it('preserves the templated path, its trailing slash and its percent-encoding', async () => {
      const surface = await surfaceOf([
        { path: '/astronauts/{id}/', status: 200 },
        { path: '/a%20b/{x}', status: 200 },
      ]);

      expect(endpointKeys(surface)).toEqual([
        'GET /astronauts/{id}/ -> 200',
        'GET /a%20b/{x} -> 200',
      ]);
    });

    it('upper-cases the method, which the format does not normalize', async () => {
      const surface = await surfaceOf([
        { method: 'patch', path: '/x', status: 200 },
      ]);

      expect(endpointKeys(surface)).toEqual(['PATCH /x -> 200']);
    });

    it('surfaces the catalog collision error rather than a second one of its own', async () => {
      // The hosts must differ: a selector is host-stripped, so these two
      // collide — but byte-identical operations collapse into a single edge
      // upstream and would assert nothing.
      const specs: TransactionSpec[] = [
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          host: 'api.one.example',
          source: 'a',
        },
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          host: 'api.two.example',
          source: 'b',
        },
      ];

      expect(formatFrom(specs).getThymianHttpTransactions()).toHaveLength(2);

      const error = await catchAsyncError(() => surfaceOf(specs));

      expect(error.name).toBe('SelectorCollisionError');
    });
  });

  describe('media parts (AC2)', () => {
    it('gates each media part on mediaType, not on a body or a schema', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 201,
          responseMediaType: 'application/json',
          // No body, no schema: the media type alone is what makes the
          // transaction distinct.
        },
      ]);

      expect(endpointKeys(surface)).toEqual([
        'POST /astronauts (application/json) -> 201 (application/json)',
      ]);
    });

    it('keeps a media-less transaction free of parentheses', async () => {
      const surface = await surfaceOf([
        { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
      ]);

      expect(endpointKeys(surface)).toEqual(['DELETE /astronauts/{id} -> 204']);
    });

    it('qualifies one side only when only that side carries a media type', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/json',
          status: 204,
        },
        {
          method: 'GET',
          path: '/b',
          status: 200,
          responseMediaType: 'text/plain',
        },
      ]);

      expect(endpointKeys(surface)).toEqual([
        'POST /a (application/json) -> 204',
        'GET /b -> 200 (text/plain)',
      ]);
    });

    it('keeps two request media types for one method and path as two entries', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/json',
          status: 201,
        },
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/xml',
          status: 201,
        },
      ]);

      expect(endpointKeys(surface)).toEqual([
        'POST /a (application/json) -> 201',
        'POST /a (application/xml) -> 201',
      ]);
    });
  });

  describe('spec-derived unions (AC3)', () => {
    it('emits all six unions plus Selector for every fixture', async () => {
      const surface = await surfaceOf([{ path: '/x', status: 200 }]);
      const emitted = declarations(surface);

      for (const union of SPEC_UNIONS) {
        expect(emitted.has(union), union).toBe(true);
      }

      expect(emitted.has('Selector')).toBe(true);
    });

    it('dedupes members and sorts strings in byte order', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/b',
          status: 200,
          responseMediaType: 'application/json',
        },
        {
          method: 'GET',
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
        },
        {
          method: 'GET',
          path: '/b',
          status: 200,
          responseMediaType: 'application/json',
        },
      ]);

      expect(unionMembers(surface, 'Method')).toEqual(['"GET"', '"POST"']);
      expect(unionMembers(surface, 'Path')).toEqual(['"/a"', '"/b"']);
      expect(unionMembers(surface, 'ResponseMediaType')).toEqual([
        '"application/json"',
      ]);
    });

    it('sorts Status numerically ascending, not lexicographically', async () => {
      const surface = await surfaceOf([
        { path: '/a', status: 500 },
        { path: '/b', status: 42 },
        { path: '/c', status: 204 },
        { path: '/d', status: 1000 },
      ]);

      expect(unionMembers(surface, 'Status')).toEqual([
        '42',
        '204',
        '500',
        '1000',
      ]);
    });

    it('emits never, not string, for an empty axis', async () => {
      const surface = await surfaceOf([
        { method: 'GET', path: '/x', status: 204 },
      ]);

      expect(unionMembers(surface, 'RequestMediaType')).toEqual(['never']);
      expect(unionMembers(surface, 'ResponseMediaType')).toEqual(['never']);
    });

    it('emits never for every axis of an empty format', async () => {
      const surface = await generateRequestTypesSurface(new ThymianFormat());

      for (const union of SPEC_UNIONS) {
        expect(unionMembers(surface, union), union).toEqual(['never']);
      }

      expect(endpointKeys(surface)).toEqual([]);
    });

    it('gives Path members the leading slash the key carries', async () => {
      // `req.path` is not guaranteed to start with one; `selectorPath` supplies
      // it, and the grammar anchors the path group on it. A raw `req.path`
      // member would name a value no key carries.
      const surface = await surfaceOf([
        { path: 'launches', status: 200 },
        { path: '/astronauts', status: 200 },
      ]);

      expect(unionMembers(surface, 'Path')).toEqual([
        '"/astronauts"',
        '"/launches"',
      ]);
      expect(endpointKeys(surface)).toContain('GET /launches -> 200');
    });

    it('takes media-type members from mediaType, not from body presence', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/json',
          status: 201,
          responseMediaType: 'application/json',
        },
      ]);

      expect(unionMembers(surface, 'RequestMediaType')).toEqual([
        '"application/json"',
      ]);
      expect(unionMembers(surface, 'ResponseMediaType')).toEqual([
        '"application/json"',
      ]);
    });

    it('emits media-type members byte-exact, including case and parameters', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/json; charset=utf-8',
          status: 201,
          responseMediaType: 'application/vnd.Example+JSON',
        },
      ]);

      expect(unionMembers(surface, 'RequestMediaType')).toEqual([
        '"application/json; charset=utf-8"',
      ]);
      expect(unionMembers(surface, 'ResponseMediaType')).toEqual([
        '"application/vnd.Example+JSON"',
      ]);
    });

    it('derives StatusClass and restricts it to the classes present', async () => {
      const surface = await surfaceOf([
        { path: '/a', status: 100 },
        { path: '/b', status: 204 },
        { path: '/c', status: 201 },
        { path: '/d', status: 599 },
      ]);

      expect(unionMembers(surface, 'StatusClass')).toEqual([
        '"1xx"',
        '"2xx"',
        '"5xx"',
      ]);
    });

    it('gives an out-of-range status a Status member and a key but no StatusClass', async () => {
      // The grammar carries no status-range rule, so `0` and `1000` are legal
      // selector shapes. Dropping their keys would break the bijection; letting
      // them into `StatusClass` would put `0xx` into 575.4's filter.
      const surface = await surfaceOf([
        { path: '/a', status: 0 },
        { path: '/b', status: 7 },
        { path: '/c', status: 1000 },
        { path: '/d', status: 200 },
      ]);

      expect(unionMembers(surface, 'Status')).toEqual([
        '0',
        '7',
        '200',
        '1000',
      ]);
      expect(unionMembers(surface, 'StatusClass')).toEqual(['"2xx"']);
      expect(endpointKeys(surface)).toEqual([
        'GET /a -> 0',
        'GET /b -> 7',
        'GET /c -> 1000',
        'GET /d -> 200',
      ]);
    });

    it('emits never for StatusClass when every status is out of range', async () => {
      const surface = await surfaceOf([{ path: '/a', status: 0 }]);

      expect(unionMembers(surface, 'StatusClass')).toEqual(['never']);
      expect(unionMembers(surface, 'Status')).toEqual(['0']);
    });
  });

  describe('additive spec change (AC4)', () => {
    it('leaves every previously emitted key byte-identical', async () => {
      const before: TransactionSpec[] = [
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 201,
          responseMediaType: 'application/json',
        },
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/json',
        },
      ];
      const after: TransactionSpec[] = [
        ...before,
        // A new status on an existing operation.
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 400,
          responseMediaType: 'application/json',
        },
        // A new response media type on an existing operation.
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/xml',
        },
        // A new request media type on an existing operation.
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/xml',
          status: 201,
          responseMediaType: 'application/json',
        },
      ];

      const original = endpointKeys(await surfaceOf(before));
      const extended = endpointKeys(await surfaceOf(after));

      expect(original.length).toBeGreaterThan(0);
      expect(extended.length).toBeGreaterThan(original.length);

      for (const key of original) {
        expect(extended, key).toContain(key);
      }
    });
  });

  describe('entry shape (AC5)', () => {
    it(
      'carries the request bag, cookies and exactly one response',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            method: 'POST',
            path: '/astronauts/{id}',
            requestMediaType: 'application/json',
            status: 201,
            responseMediaType: 'application/json',
            requestBody: {
              type: 'object',
              properties: { name: { type: 'string' } },
            },
            responseSchema: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
            queryParameters: { limit: param({ type: 'number' }, true) },
            pathParameters: { id: param({ type: 'string' }, true) },
            headers: { 'x-trace': param({ type: 'string' }) },
            cookies: { session: param({ type: 'string' }) },
            responseHeaders: { etag: param({ type: 'string' }) },
          },
        ]);
        const entry = entryText(
          surface,
          'POST /astronauts/{id} (application/json) -> 201 (application/json)',
        );

        expect(entry).toContain('body:');
        expect(entry).toContain('query:');
        expect(entry).toContain('path:');
        expect(entry).toContain('headers');
        expect(entry).toContain('cookies');
        expect(entry).toContain('statusCode: 201;');
        // v1 emitted `res` as a union of every response because one key covered
        // them all. In v2 the status is part of the key, so there is exactly one.
        expect(entry.match(/statusCode:/g)).toHaveLength(1);
        expect(compile(surface).diagnostics).toEqual([]);
      },
    );

    it('omits body from a bodyless request and a schema-less response', async () => {
      const surface = await surfaceOf([
        { method: 'DELETE', path: '/a/{id}', status: 204 },
      ]);
      const entry = entryText(surface, 'DELETE /a/{id} -> 204');

      expect(entry).not.toContain('body:');
      expect(entry).toContain('statusCode: 204;');
    });

    it('marks a bag optional unless one of its parameters is required', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          queryParameters: { limit: param({ type: 'number' }, true) },
          cookies: { session: param({ type: 'string' }, false) },
        },
      ]);
      const entry = entryText(surface, 'GET /a -> 200');

      expect(entry).toContain('query: ');
      expect(entry).toContain('cookies?: ');
    });

    it(
      'keeps the open index signatures, so a hook may set an undeclared header',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            path: '/a',
            status: 200,
            queryParameters: { limit: param({ type: 'number' }, true) },
            pathParameters: {},
            headers: { 'x-declared': param({ type: 'string' }, true) },
            cookies: { session: param({ type: 'string' }, true) },
          },
        ]);
        const { diagnostics } = compile(surface, {
          'probe.ts': `
            import type { Endpoints } from './generated.js';

            const req: Endpoints['GET /a -> 200']['req'] = {
              query: { limit: 1, 'not-in-the-spec': 'ok' },
              headers: { 'x-declared': 'a', 'x-undeclared': 'b' },
              cookies: { session: 's', extra: 2 },
            };

            export const used = req;
          `,
        });

        expect(diagnostics).toEqual([]);
      },
    );

    it(
      'makes a stale selector a compile error at the hook, not a runtime surprise',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([{ path: '/a', status: 200 }]);
        const { diagnostics } = compile(surface, {
          'probe.ts': `
            import type { Endpoints } from './generated.js';

            export type Gone = Endpoints['GET /removed -> 200'];
          `,
        });

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.join('\n')).toContain('GET /removed -> 200');
      },
    );
  });

  describe('example reflection (AC6)', () => {
    it('reflects primitive examples as an open literal union', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', examples: ['Neil', 'Buzz'] },
              rank: { type: 'integer', examples: [1, 2] },
              active: { type: 'boolean', examples: [true] },
            },
          },
        },
      ]);

      expect(surface).toContain('"Neil" | "Buzz" | (string & {})');
      expect(surface).toContain('1 | 2 | (number & {})');
      expect(surface).toContain('true | (boolean & {})');
    });

    it('reflects object examples as example-or-base with a compiled base', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            examples: [{ id: 'a1' }, { id: 'a2' }],
            properties: { id: { type: 'string' } },
          },
        },
      ]);
      const emitted = declarations(surface);

      // `json-schema-to-typescript` re-formats the `tsType` it is handed, so the
      // emitted spelling is its own, not the one this generator wrote.
      expect(surface).toContain('{id: "a1"}');
      expect(surface).toContain('{id: "a2"}');

      const baseNames = [...emitted.keys()].filter((name) =>
        name.endsWith('Base'),
      );

      expect(baseNames).toHaveLength(1);
      expect(surface).toContain(`| ${baseNames[0] ?? ''}`);
    });

    it(
      'keeps a reflected primitive assignable from an arbitrary value',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            path: '/a',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { name: { type: 'string', examples: ['Neil'] } },
            },
          },
        ]);
        const { diagnostics } = compile(surface, {
          'probe.ts': `
            import type { Endpoints } from './generated.js';

            type Body = Endpoints['GET /a -> 200 (application/json)']['res']['body'];

            // An example is a hint, not a constraint: a value the description
            // never listed must still type-check.
            export const notAnExample: Body = { name: 'Valentina' };
          `,
        });

        expect(diagnostics).toEqual([]);
      },
    );

    it(
      'keeps a reflected object body assignable from an arbitrary value',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            path: '/a',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'object',
              examples: [{ id: 'a1' }],
              properties: { id: { type: 'string' } },
            },
          },
        ]);
        const { diagnostics } = compile(surface, {
          'probe.ts': `
            import type { Endpoints } from './generated.js';

            type Body = Endpoints['GET /a -> 200 (application/json)']['res']['body'];

            export const notAnExample: Body = { id: 'zzz' };
          `,
        });

        expect(diagnostics).toEqual([]);
      },
    );

    it('leaves enum and const nodes closed', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: ['crewed', 'uncrewed'],
                examples: ['crewed'],
              },
              version: { type: 'string', const: 'v1', examples: ['v1'] },
            },
          },
        },
      ]);

      expect(surface).toContain('"crewed" | "uncrewed"');
      expect(surface).not.toContain('"crewed" | (string & {})');
      expect(surface).not.toContain('"v1" | (string & {})');
    });

    it('ignores an example that does not match the declared type', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              count: { type: 'integer', examples: ['not-a-number', 7, 1.5] },
              name: { type: 'string', examples: [42] },
            },
          },
        },
      ]);

      expect(surface).toContain('7 | (number & {})');
      expect(surface).not.toContain('"not-a-number"');
      expect(surface).not.toContain('1.5');
      expect(surface).not.toContain('42 | (string & {})');
    });

    it('ignores an empty examples array and an absent one', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              empty: { type: 'string', examples: [] },
              absent: { type: 'string' },
            },
          },
        },
      ]);

      expect(surface).not.toContain('(string & {})');
    });

    it('dedupes repeated examples', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', examples: ['Neil', 'Neil', 'Buzz'] },
            },
          },
        },
      ]);

      expect(surface).toContain('"Neil" | "Buzz" | (string & {})');
    });

    it(
      'does not follow a $ref while reflecting, and still compiles',
      COMPILE_TIMEOUT,
      async () => {
        // A self-referential schema is normal input (ADR-0013). Following the
        // `$ref` would not terminate; reflecting onto it would emit a
        // self-referential alias.
        const surface = await surfaceOf([
          {
            path: '/a',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                child: { $ref: '#/$defs/Node', examples: [{ name: 'x' }] },
              },
              $defs: {
                Node: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', examples: ['x'] },
                    next: { $ref: '#/$defs/Node' },
                  },
                },
              },
            },
          },
        ]);

        expect(surface).toContain('"x" | (string & {})');
        expect(compile(surface).diagnostics).toEqual([]);
      },
    );
  });

  describe('declaration names (AC7)', () => {
    it('derives declaration names from the selector and the role', async () => {
      const surface = await surfaceOf([
        {
          method: 'GET',
          path: '/astronauts/{id}',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          queryParameters: { limit: param({ type: 'number' }, true) },
        },
      ]);
      const names = [...declarations(surface).keys()];

      expect(names.some((name) => /^GetAstronautsId200/.test(name))).toBe(true);
      expect(names.some((name) => name.endsWith('ResponseBody'))).toBe(true);
      expect(names.some((name) => name.endsWith('QueryParam_Limit'))).toBe(
        true,
      );
      expect(names.some((name) => /^GeneratedSchema\d+$/.test(name))).toBe(
        false,
      );
    });

    it('leaves an existing transaction untouched when one is inserted ahead of it', async () => {
      const existing: TransactionSpec = {
        method: 'GET',
        path: '/launches',
        status: 200,
        responseMediaType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        queryParameters: { limit: param({ type: 'number' }, true) },
      };
      const inserted: TransactionSpec = {
        method: 'POST',
        path: '/astronauts',
        requestMediaType: 'application/json',
        status: 201,
        requestBody: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      };

      const beforeNames = schemaDeclarations(await surfaceOf([existing]));
      const afterNames = schemaDeclarations(
        await surfaceOf([inserted, existing]),
      );

      expect(beforeNames.size).toBeGreaterThan(0);

      for (const [name, text] of beforeNames) {
        expect(afterNames.get(name), name).toBe(text);
      }
    });

    it(
      'emits a shared $defs entry once and compiles with zero diagnostics',
      COMPILE_TIMEOUT,
      async () => {
        const pet: ThymianSchema = {
          type: 'object',
          properties: { name: { type: 'string' } },
        };
        const surface = await surfaceOf([
          {
            method: 'GET',
            path: '/pets',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'array',
              items: { $ref: '#/$defs/Pet' },
              $defs: { Pet: pet },
            },
          },
          {
            method: 'GET',
            path: '/pets/{id}',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: { $ref: '#/$defs/Pet', $defs: { Pet: pet } },
          },
        ]);

        expect(surface.match(/^export interface Pet \{/gm)).toHaveLength(1);
        expect(compile(surface).diagnostics).toEqual([]);
      },
    );

    it(
      'separates two same-named definitions whose content differs',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            method: 'GET',
            path: '/a',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              $ref: '#/$defs/Error',
              $defs: {
                Error: {
                  type: 'object',
                  properties: { code: { type: 'string' } },
                },
              },
            },
          },
          {
            method: 'GET',
            path: '/b',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              $ref: '#/$defs/Error',
              $defs: {
                Error: {
                  type: 'object',
                  properties: { detail: { type: 'number' } },
                },
              },
            },
          },
        ]);
        const names = [...declarations(surface).keys()];

        expect(names).toContain('Error');
        expect(names).toContain('Error_2');
        expect(compile(surface).diagnostics).toEqual([]);
      },
    );

    it(
      'gives two selectors that sanitise to one stem distinct, stable names',
      COMPILE_TIMEOUT,
      async () => {
        // `A-B` and `A.B` are both RFC 9110 tchar methods and both sanitise to
        // `AB`, so the two transactions want the same identifier.
        const specs: TransactionSpec[] = [
          {
            method: 'A-B',
            path: '/x',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { p: { type: 'string' } },
            },
          },
          {
            method: 'A.B',
            path: '/x',
            status: 200,
            responseMediaType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { q: { type: 'number' } },
            },
          },
        ];
        const first = declarations(await surfaceOf(specs));
        const again = declarations(await surfaceOf(specs));
        const bodyNames = [...first.keys()].filter((name) =>
          name.startsWith('ABX200'),
        );

        expect(bodyNames.length).toBeGreaterThanOrEqual(2);
        expect(new Set(bodyNames).size).toBe(bodyNames.length);
        expect(bodyNames.some((name) => name.includes('_2'))).toBe(true);
        expect([...again.keys()]).toEqual([...first.keys()]);
        expect(compile(await surfaceOf(specs)).diagnostics).toEqual([]);
      },
    );

    it('names an unnameable parameter rather than merging it away', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          headers: {
            '': param({ type: 'string' }),
            '-': param({ type: 'number' }),
          },
        },
      ]);
      const names = [...declarations(surface).keys()].filter((name) =>
        name.includes('Header_Unnamed'),
      );

      expect(names).toHaveLength(2);
      expect(new Set(names).size).toBe(2);
    });
  });

  describe('determinism (AC8)', () => {
    const specs: TransactionSpec[] = [
      {
        method: 'POST',
        path: '/astronauts',
        requestMediaType: 'application/json',
        status: 201,
        responseMediaType: 'application/json',
        requestBody: {
          type: 'object',
          properties: {
            name: { type: 'string', examples: ['Neil'] },
            agency: { $ref: '#/$defs/Agency' },
          },
          $defs: {
            Agency: {
              type: 'object',
              properties: { code: { type: 'string' } },
            },
          },
        },
        responseSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        queryParameters: {
          limit: param({ type: 'number' }, true),
          offset: param({ type: 'number' }),
        },
        headers: { 'x-trace': param({ type: 'string' }) },
      },
      {
        method: 'GET',
        path: '/launches',
        status: 200,
        responseMediaType: 'application/json',
      },
    ];

    it('produces byte-identical output across generations', async () => {
      expect(await surfaceOf(specs)).toBe(await surfaceOf(specs));
    });

    it('produces byte-identical output after an export/import round trip', async () => {
      // 575.2 could only prove `fromThymianFormat` is pure, because both its
      // catalogs came from one `ThymianFormat` instance. The property the
      // committed surface depends on needs the format rebuilt the way every
      // load rebuilds it (`src/index.ts:227`).
      const format = formatFrom(specs);
      const first = await generateRequestTypesSurface(format);
      const roundTripped = ThymianFormat.import(format.export());

      expect(await generateRequestTypesSurface(roundTripped)).toBe(first);
    });

    it('keeps Endpoints in catalog order rather than sorting it', async () => {
      const unsorted: TransactionSpec[] = [
        { method: 'GET', path: '/zebra', status: 200 },
        { method: 'GET', path: '/aardvark', status: 200 },
      ];

      expect(endpointKeys(await surfaceOf(unsorted))).toEqual([
        'GET /zebra -> 200',
        'GET /aardvark -> 200',
      ]);
    });

    it('emits no comment beyond the banner and schema JSDoc', async () => {
      const surface = await surfaceOf([
        {
          path: '/a',
          status: 200,
          responseMediaType: 'application/json',
          responseSchema: { type: 'object', description: 'A launch.' },
        },
      ]);

      expect(surface).toContain('THIS FILE IS AUTO-GENERATED');
      expect(surface).toContain('A launch.');
      expect(surface).not.toMatch(/Generated at|generated on \d/);
    });
  });

  describe('non-JSON fallback (AC9)', () => {
    it('types a non-JSON body as unknown, never as any', async () => {
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/upload',
          requestMediaType: 'application/octet-stream',
          status: 200,
          responseMediaType: 'text/plain',
          requestBody: { type: 'string', examples: ['abc'] },
          responseSchema: { type: 'string', examples: ['ok'] },
        },
      ]);
      const entry = entryText(
        surface,
        'POST /upload (application/octet-stream) -> 200 (text/plain)',
      );

      expect(entry).toContain('body: unknown;');
      expect(entry).not.toContain(': any');
      // A non-JSON body contributes no declaration at all, reflected or not.
      expect(surface).not.toContain('"abc"');
      expect(surface).not.toContain('"ok"');
    });

    it(
      'compiles a +json body under a case-preserved key',
      COMPILE_TIMEOUT,
      async () => {
        // The gate case-folds and strips parameters; the selector does neither.
        // Both behaviours are intended, and this pins the asymmetry.
        const surface = await surfaceOf([
          {
            method: 'POST',
            path: '/a',
            requestMediaType: 'application/vnd.Example+JSON',
            status: 201,
            responseMediaType: 'application/json; charset=utf-8',
            requestBody: {
              type: 'object',
              properties: { a: { type: 'string' } },
            },
            responseSchema: {
              type: 'object',
              properties: { b: { type: 'string' } },
            },
          },
        ]);
        const key =
          'POST /a (application/vnd.Example+JSON) -> 201 (application/json; charset=utf-8)';

        expect(endpointKeys(surface)).toEqual([key]);
        expect(entryText(surface, key)).not.toContain('body: unknown');
        expect(compile(surface).diagnostics).toEqual([]);
      },
    );
  });

  describe('media-type policy (AC14)', () => {
    it('treats application/JSON and application/json as two keys and two members', async () => {
      // RFC 9110 section 8.3.1 makes them the same media type. Emission stays
      // byte-exact because the emitted literal must equal the runtime catalog
      // key; case-insensitive LOOKUP is left open on #620.
      const surface = await surfaceOf([
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/JSON',
          status: 201,
        },
        {
          method: 'POST',
          path: '/a',
          requestMediaType: 'application/json',
          status: 201,
        },
      ]);

      expect(endpointKeys(surface)).toEqual([
        'POST /a (application/JSON) -> 201',
        'POST /a (application/json) -> 201',
      ]);
      expect(unionMembers(surface, 'RequestMediaType')).toEqual([
        '"application/JSON"',
        '"application/json"',
      ]);
    });

    it('aborts on a media type containing a parenthesis', async () => {
      // RFC 9110 section 5.6.4 permits one inside a quoted-string parameter;
      // the grammar cannot represent it. Left open on #635.
      const error = await catchAsyncError(() =>
        surfaceOf([
          {
            method: 'POST',
            path: '/a',
            requestMediaType: 'application/json; note="(draft)"',
            status: 201,
          },
        ]),
      );

      expect(error.name).toBe('MalformedSelectorError');
    });
  });

  describe('one selector producer, and keys that round-trip (AC13)', () => {
    it('never constructs a selector string', () => {
      const directory = fileURLToPath(
        new URL('../src/generation/types/', import.meta.url),
      );
      const files = readdirSync(directory, {
        recursive: true,
        withFileTypes: true,
      }).filter((entry) => entry.isFile() && entry.name.endsWith('.ts'));

      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const source = readFileSync(`${file.parentPath}/${file.name}`, 'utf-8');
        // The identifier checks are made against the IMPORTS rather than the
        // whole text, so a docblock may still name the producer it is telling
        // the reader not to call. The separator check stays whole-text: no
        // template literal, string or comment in here may spell a selector.
        const imports = source.match(/^import[\s\S]*?;$/gm)?.join('\n') ?? '';

        // The bare arrow and not just the spaced separator: an arrow function
        // is `=>`, so nothing legitimate in these files spells `-` followed by
        // `>`, which makes the tighter form free of false positives and catches
        // a hand-built key however it spaces its separator.
        expect(source, file.name).not.toContain('-' + '>');
        // The only producer of a selector string lives in `src/selectors/`, and
        // nothing here may import it or build a second one.
        expect(imports, file.name).not.toContain('formatSelector');
        expect(imports, file.name).not.toContain('selectorForTransaction');
        // The parser is diagnostics-only; it must never be on a generation path.
        expect(imports, file.name).not.toContain('parseSelector');
        expect(source, file.name).not.toMatch(/\bnode:fs\b/);
        expect(source, file.name).not.toMatch(/samples-structure/);
      }

      // The guard is only worth anything if the imports it inspects are really
      // there: a rename that emptied the match would make it vacuous.
      const entry = readFileSync(
        `${directory}generate-request-types-surface.ts`,
        'utf-8',
      );

      expect(entry.match(/^import[\s\S]*?;$/gm)?.join('\n')).toContain(
        'TransactionCatalog',
      );
    });

    it('emits keys the parser accepts and the formatter reproduces', async () => {
      const specs: TransactionSpec[] = [
        {
          method: 'post',
          path: '/astronauts/{id}',
          requestMediaType: 'application/json; charset=utf-8',
          status: 201,
          responseMediaType: 'application/vnd.Example+JSON',
        },
        { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
        { method: 'GET', path: 'launches', status: 200 },
        { method: 'A`B', path: '/tchar', status: 0 },
      ];
      const format = formatFrom(specs);
      const catalog = TransactionCatalog.fromThymianFormat(format);
      const keys = endpointKeys(await generateRequestTypesSurface(format));

      expect(keys).toHaveLength(specs.length);

      for (const [selector, transaction] of catalog.entries()) {
        expect(keys).toContain(selector);

        const parts = parseSelector(selector);
        const { thymianReq: req, thymianRes: res } = transaction;

        expect(parts.method).toBe(req.method.toUpperCase());
        expect(parts.path).toBe(selectorPath(req.path));
        expect(parts.status).toBe(res.statusCode);
        expect(parts.requestMediaType).toBe(req.mediaType || undefined);
        expect(parts.responseMediaType).toBe(res.mediaType || undefined);
        // The round trip that matters: the emitted key is the string the
        // runtime formatter produces, not merely one the parser tolerates.
        expect(selectorForTransaction(transaction)).toBe(selector);
      }
    });
  });

  describe('abort on an unrepresentable transaction (AC15)', () => {
    it('propagates MalformedSelectorError with its suggestions for a path with whitespace', async () => {
      const error = await catchAsyncError(() =>
        surfaceOf([{ path: '/a b', status: 200 }]),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(error.options.suggestions?.join('\n')).toContain(
        'contains whitespace',
      );
    });

    it('propagates MalformedSelectorError for a path containing the separator', async () => {
      const error = await catchAsyncError(() =>
        surfaceOf([{ path: '/a-' + '>b', status: 200 }]),
      );

      expect(error.name).toBe('MalformedSelectorError');
    });

    it('produces no partial surface when one transaction of many is unrepresentable', async () => {
      const error = await catchAsyncError(() =>
        surfaceOf([
          { path: '/fine', status: 200 },
          { path: '/not fine', status: 200 },
          { path: '/also-fine', status: 200 },
        ]),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(catchError(() => parseSelector('/fine')).name).toBe(
        'MalformedSelectorError',
      );
    });
  });

  describe('Selector (AC16)', () => {
    it(
      'emits Selector as keyof Endpoints, resolving to the emitted keys',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          { method: 'GET', path: '/a', status: 200 },
          { method: 'GET', path: '/b', status: 204 },
        ]);

        expect(declarations(surface).get('Selector')).toBe(
          'export type Selector = keyof Endpoints;',
        );

        const { diagnostics } = compile(surface, {
          'probe.ts': `
            import type { Selector } from './generated.js';

            export const known: Selector = 'GET /a -> 200';
          `,
          'probe-stale.ts': `
            import type { Selector } from './generated.js';

            export const stale: Selector = 'GET /gone -> 200';
          `,
        });

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain('probe-stale.ts');
      },
    );
  });

  describe('the emitted file as a whole (AC12)', () => {
    it(
      'compiles with zero diagnostics for a broad fixture',
      COMPILE_TIMEOUT,
      async () => {
        const surface = await surfaceOf([
          {
            method: 'POST',
            path: '/astronauts',
            requestMediaType: 'application/json',
            status: 201,
            responseMediaType: 'application/json',
            requestBody: {
              type: 'object',
              properties: {
                name: { type: 'string', examples: ['Neil'] },
                agency: { $ref: '#/$defs/Agency' },
                profile: {
                  type: 'object',
                  examples: [{ bio: 'x' }],
                  properties: { bio: { type: 'string' } },
                },
              },
              $defs: {
                Agency: {
                  type: 'object',
                  properties: { code: { type: 'string' } },
                },
              },
            },
            responseSchema: {
              $ref: '#/$defs/Agency',
              $defs: { Agency: { type: 'object' } },
            },
            queryParameters: { limit: param({ type: 'number' }, true) },
            pathParameters: {},
            headers: { 'x-trace': param({ type: 'string' }) },
            cookies: { session: param({ type: 'string' }) },
            responseHeaders: { etag: param({ type: 'string' }) },
          },
          { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
          {
            method: 'GET',
            path: '/blob',
            status: 200,
            responseMediaType: 'application/octet-stream',
            responseSchema: { type: 'string' },
          },
          { method: 'GET', path: '/odd', status: 0 },
        ]);

        expect(compile(surface).diagnostics).toEqual([]);
      },
    );
  });
});
