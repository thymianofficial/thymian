import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  type ThymianError,
  ThymianFormat,
  type ThymianFormatLocation,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { TransactionCatalog } from '../../src/selectors/transaction-catalog.js';

function catchError(fn: () => unknown): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to throw, but it returned normally.');
}

function suggestionsOf(error: ThymianError): string[] {
  return error.options.suggestions ?? [];
}

type TransactionSpec = {
  method: string;
  path: string;
  requestMediaType?: string;
  status: number;
  responseMediaType?: string;
  host?: string;
  protocol?: 'http' | 'https';
  source?: string;
  sourceLocation?: ThymianFormatLocation;
  description?: string;
};

/**
 * Hand-builds a format from explicit request/response literals. The generated
 * `createThymianFormatWithTransactions` fixture cannot express differing hosts,
 * media types or sources, which is what the collision and media-variant cases
 * are about.
 */
function formatFrom(specs: TransactionSpec[]): ThymianFormat {
  const format = new ThymianFormat();

  for (const spec of specs) {
    const source = spec.source ?? 'test-source';
    const request: ThymianHttpRequest = createHttpRequest({
      method: spec.method,
      path: spec.path,
      host: spec.host ?? 'localhost',
      port: 8080,
      protocol: spec.protocol ?? 'http',
      mediaType: spec.requestMediaType ?? '',
      sourceName: source,
      ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
      ...(spec.description ? { description: spec.description } : {}),
    });
    const response: ThymianHttpResponse = createHttpResponse({
      statusCode: spec.status,
      mediaType: spec.responseMediaType ?? '',
      sourceName: source,
    });

    format.addHttpTransaction(request, response, source);
  }

  return format;
}

type OpenApiShapedSpec = {
  source: string;
  /** Lands on the response node, which is where OpenAPI puts it. */
  responseDescription: string;
  sourceLocation?: ThymianFormatLocation;
};

/**
 * Builds the graph the way `plugin-openapi` actually builds it
 * (`openapi.processor.ts:151-175`): one `addRequest` per source, then
 * `addResponseToRequest` with the response and the edge attributes — and
 * crucially *without* the 4th `sourceName` argument, which core does not expose
 * to the processor.
 *
 * `formatFrom` cannot express this shape. It goes through `addHttpTransaction`,
 * sets `sourceName` on both nodes itself, and every colliding fixture built with
 * it gives the two sides different `host`s — so its request nodes never dedupe.
 * No real producer does either of those things, which is why a collision fixture
 * built on it cannot see a misattributed source.
 */
function openApiShapedFormat(specs: OpenApiShapedSpec[]): ThymianFormat {
  const format = new ThymianFormat();

  for (const spec of specs) {
    // Byte-identical across sources: no `servers` block in either document, so
    // both default to the same origin, and `sourceName` is in
    // `ignoredHashProperties` — the second source dedupes into the first's node.
    const reqId = format.addRequest({
      ...createHttpRequest({
        method: 'GET',
        path: '/users',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        mediaType: '',
      }),
      sourceName: spec.source,
    });

    format.addResponseToRequest(
      reqId,
      {
        ...createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          description: spec.responseDescription,
        }),
        sourceName: spec.source,
        ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
      },
      {
        sourceName: spec.source,
        ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
      },
    );
  }

  return format;
}

const baseSpecs: TransactionSpec[] = [
  {
    method: 'GET',
    path: '/launches',
    status: 200,
    responseMediaType: 'application/json',
  },
  {
    method: 'POST',
    path: '/astronauts',
    requestMediaType: 'application/json',
    status: 201,
    responseMediaType: 'application/json',
  },
  { method: 'DELETE', path: '/astronauts/{id}', status: 204 },
];

describe('TransactionCatalog', () => {
  it('is bijective over every transaction of the format', () => {
    const format = createThymianFormatWithTransactions(20);
    const transactions = format.getThymianHttpTransactions();
    const catalog = TransactionCatalog.fromThymianFormat(format);

    expect(catalog.size).toBe(transactions.length);
    expect(catalog.selectors()).toHaveLength(transactions.length);
    expect(new Set(catalog.selectors()).size).toBe(transactions.length);

    for (const selector of catalog.selectors()) {
      const resolved = catalog.resolve(selector);

      expect(catalog.selectorFor(resolved.transactionId)).toBe(selector);
    }

    for (const transaction of transactions) {
      const selector = catalog.selectorFor(transaction.transactionId);

      expect(selector).toBeDefined();
      expect(catalog.resolve(String(selector)).transactionId).toBe(
        transaction.transactionId,
      );
    }

    expect(catalog.entries()).toHaveLength(transactions.length);
  });

  /**
   * The generated fixture emits one shape only — request `mediaType: ''`,
   * response `application/json`, an already-slashed path — so bijectivity over
   * it stays green even if the request-media part is dropped. This fixture
   * varies every axis the selector is built from.
   */
  it('is bijective over a format that varies every selector axis', () => {
    const format = formatFrom([
      ...baseSpecs,
      {
        method: 'POST',
        path: '/astronauts',
        requestMediaType: 'application/xml',
        status: 201,
        responseMediaType: 'application/json',
      },
      {
        method: 'GET',
        path: '/launches',
        status: 200,
        responseMediaType: 'application/xml',
      },
      { method: 'get', path: 'unslashed', status: 200 },
    ]);
    const transactions = format.getThymianHttpTransactions();
    const catalog = TransactionCatalog.fromThymianFormat(format);

    expect(catalog.size).toBe(transactions.length);
    expect(catalog.selectors()).toEqual([
      'GET /launches -> 200 (application/json)',
      'POST /astronauts (application/json) -> 201 (application/json)',
      'DELETE /astronauts/{id} -> 204',
      'POST /astronauts (application/xml) -> 201 (application/json)',
      'GET /launches -> 200 (application/xml)',
      'GET /unslashed -> 200',
    ]);

    for (const transaction of transactions) {
      const selector = catalog.selectorFor(transaction.transactionId);

      expect(catalog.resolve(String(selector)).transactionId).toBe(
        transaction.transactionId,
      );
    }
  });

  it('mirrors getThymianHttpTransactions order and is stable across builds', () => {
    const format = createThymianFormatWithTransactions(20);
    const first = TransactionCatalog.fromThymianFormat(format);
    const second = TransactionCatalog.fromThymianFormat(format);

    expect(second.selectors()).toEqual(first.selectors());
    expect(first.selectors()).toEqual(
      format
        .getThymianHttpTransactions()
        .map((transaction) => first.selectorFor(transaction.transactionId)),
    );
  });

  it('keeps every pre-existing selector byte-identical under additive change', () => {
    const before = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));
    const after = TransactionCatalog.fromThymianFormat(
      formatFrom([
        ...baseSpecs,
        // an added response status on an existing operation
        {
          method: 'GET',
          path: '/launches',
          status: 404,
          responseMediaType: 'application/problem+json',
        },
        // an added response media type on an existing operation
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/xml',
        },
      ]),
    );

    expect(after.size).toBe(before.size + 2);

    for (const selector of before.selectors()) {
      expect(after.selectors()).toContain(selector);

      const wasResolved = before.resolve(selector);
      const isResolved = after.resolve(selector);

      expect(isResolved.thymianReq.method).toBe(wasResolved.thymianReq.method);
      expect(isResolved.thymianReq.path).toBe(wasResolved.thymianReq.path);
      expect(isResolved.thymianReq.mediaType).toBe(
        wasResolved.thymianReq.mediaType,
      );
      expect(isResolved.thymianRes.statusCode).toBe(
        wasResolved.thymianRes.statusCode,
      );
      expect(isResolved.thymianRes.mediaType).toBe(
        wasResolved.thymianRes.mediaType,
      );
    }
  });

  it('distinguishes transactions that differ only in request media type', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/json',
          status: 201,
        },
        {
          method: 'POST',
          path: '/astronauts',
          requestMediaType: 'application/xml',
          status: 201,
        },
      ]),
    );

    expect(catalog.size).toBe(2);
    expect(
      catalog.resolve('POST /astronauts (application/json) -> 201').thymianReq
        .mediaType,
    ).toBe('application/json');
    expect(
      catalog.resolve('POST /astronauts (application/xml) -> 201').thymianReq
        .mediaType,
    ).toBe('application/xml');
  });

  it('distinguishes transactions that differ only in response media type', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/json',
        },
        {
          method: 'GET',
          path: '/launches',
          status: 200,
          responseMediaType: 'application/xml',
        },
      ]),
    );

    expect(catalog.size).toBe(2);
    expect(
      catalog.resolve('GET /launches -> 200 (application/json)').thymianRes
        .mediaType,
    ).toBe('application/json');
    expect(
      catalog.resolve('GET /launches -> 200 (application/xml)').thymianRes
        .mediaType,
    ).toBe('application/xml');
  });

  it('refuses to index a transaction whose rendering is not a selector', () => {
    // `responses: { OK: … }` survives `plugin-openapi`'s `n < 100 || n > 599`
    // guard (both comparisons are false for NaN) and reaches the catalog as
    // `statusCode: NaN`. Indexing it would put an unparseable key in the map.
    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(
        formatFrom([{ method: 'GET', path: '/pets', status: Number.NaN }]),
      ),
    );

    expect(error.name).toBe('MalformedSelectorError');
    expect(error.message).toBe(
      '"GET /pets -> NaN" is not a valid transaction selector.',
    );
  });

  it('throws SelectorCollisionError naming both sources', () => {
    const format = formatFrom([
      {
        method: 'GET',
        path: '/users',
        status: 200,
        responseMediaType: 'application/json',
        host: 'api.one.example',
        source: 'source-one',
      },
      {
        method: 'GET',
        path: '/users',
        status: 200,
        responseMediaType: 'application/json',
        host: 'api.two.example',
        source: 'source-two',
      },
    ]);

    // The fixture must really carry two transactions — byte-identical
    // operations collapse into a single edge upstream and would assert nothing.
    expect(format.getThymianHttpTransactions()).toHaveLength(2);

    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(format),
    );

    expect(error.name).toBe('SelectorCollisionError');
    expect(error.message).toContain('GET /users -> 200 (application/json)');

    const suggestions = suggestionsOf(error).join('\n');

    expect(suggestions).toContain('source-one');
    expect(suggestions).toContain('source-two');
    expect(suggestions).toContain('http://api.one.example:8080');
    expect(suggestions).toContain('http://api.two.example:8080');
    expect(suggestions).toContain('Load the sources separately');
  });

  it('quotes the source location of each colliding transaction', () => {
    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(
        formatFrom([
          {
            method: 'GET',
            path: '/users',
            status: 200,
            host: 'api.one.example',
            source: 'source-one',
            sourceLocation: {
              path: 'a.yaml',
              position: { line: 6, column: 5, offset: 42 },
            },
          },
          {
            method: 'GET',
            path: '/users',
            status: 200,
            host: 'api.two.example',
            source: 'source-two',
            sourceLocation: {
              path: 'b.yaml',
              position: { line: 15, column: 5, offset: 99 },
            },
          },
        ]),
      ),
    );

    expect(error.name).toBe('SelectorCollisionError');
    expect(suggestionsOf(error)[0]).toBe(
      'Source "source-one" describes it at http://api.one.example:8080 (a.yaml:6:5).',
    );
    expect(suggestionsOf(error)[1]).toBe(
      'Source "source-two" describes it at http://api.two.example:8080 (b.yaml:15:5).',
    );
  });

  /**
   * Reachable from a single valid document: node identity ignores only `label`,
   * `sourceLocation` and `sourceName`, so two operations that differ in
   * anything a selector does not carry — a description, a query parameter, a
   * header, `bodyRequired`, or a base path re-added by an operation-level
   * `servers` override — arrive as two transactions and collide. Telling that
   * user to "load the sources separately" is advice they cannot follow.
   */
  it('does not tell a same-source collision to load its sources separately', () => {
    const format = formatFrom([
      {
        method: 'GET',
        path: '/v1/pets',
        status: 200,
        source: 'only-source',
        description: 'Lists pets.',
        sourceLocation: {
          path: 's.yaml',
          position: { line: 6, column: 5, offset: 42 },
        },
      },
      {
        method: 'GET',
        path: '/v1/pets',
        status: 200,
        source: 'only-source',
        description: 'Lists pets, again.',
        sourceLocation: {
          path: 's.yaml',
          position: { line: 15, column: 5, offset: 99 },
        },
      },
    ]);

    expect(format.getThymianHttpTransactions()).toHaveLength(2);

    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(format),
    );

    expect(error.name).toBe('SelectorCollisionError');

    const suggestions = suggestionsOf(error);

    expect(suggestions.join('\n')).not.toContain('Load the sources separately');
    expect(suggestions.join('\n')).toContain('same source');
    expect(suggestions[0]).toContain('s.yaml:6:5');
    expect(suggestions[1]).toContain('s.yaml:15:5');
  });

  /**
   * Regression guard for the second-pass review finding. The discriminator used
   * to be the *edge* `sourceName`, which core derives as
   * `sourceName ?? req.sourceName` (`thymian-format.ts:233`). Because
   * `sourceName` sits in `ignoredHashProperties`, a request node is deduped
   * across sources, so both edges of a two-description collision on one origin
   * report the *first* source: the second source was never named, and the
   * flagship cross-source case was told "loading the sources separately cannot
   * help" — the exact inverse of the fix.
   *
   * The fixture has to be the shape `plugin-openapi` produces, not
   * `formatFrom`'s: that helper's differing hosts keep the request nodes apart
   * and hide the defect entirely.
   */
  describe('a cross-source collision that shares one origin', () => {
    const twoDescriptions: OpenApiShapedSpec[] = [
      {
        source: 'users-a',
        responseDescription: 'The users of service A.',
        sourceLocation: {
          path: 'users-a.yaml',
          position: { line: 8, column: 7, offset: 61 },
        },
      },
      {
        source: 'users-b',
        responseDescription: 'The users of service B.',
        sourceLocation: {
          path: 'users-b.yaml',
          position: { line: 12, column: 7, offset: 88 },
        },
      },
    ];

    // The fixture is only faithful if it reproduces the dedupe: two
    // transactions hanging off ONE request node, so that every edge — the old
    // discriminator — reports the first source while the response nodes, the
    // one part a collision cannot share, still report their own.
    it('is built on a deduped request node, as plugin-openapi builds it', () => {
      const transactions =
        openApiShapedFormat(twoDescriptions).getThymianHttpTransactions();

      expect(transactions).toHaveLength(2);
      expect(transactions[0]?.thymianReqId).toBe(transactions[1]?.thymianReqId);
      expect(transactions.map((t) => t.transaction.sourceName)).toEqual([
        'users-a',
        'users-a',
      ]);
      expect(transactions.map((t) => t.thymianReq.sourceName)).toEqual([
        'users-a',
        'users-a',
      ]);
      expect(transactions.map((t) => t.thymianRes.sourceName)).toEqual([
        'users-a',
        'users-b',
      ]);
    });

    it('names the second source, and quotes its own location', () => {
      const error = catchError(() =>
        TransactionCatalog.fromThymianFormat(
          openApiShapedFormat(twoDescriptions),
        ),
      );

      expect(error.name).toBe('SelectorCollisionError');

      const suggestions = suggestionsOf(error);

      expect(suggestions[1]).toContain('Source "users-b"');
      expect(suggestions[0]).toBe(
        'Source "users-a" describes it at http://localhost:8080 (users-a.yaml:8:7).',
      );
      expect(suggestions[1]).toBe(
        'Source "users-b" describes it at http://localhost:8080 (users-b.yaml:12:7).',
      );
    });

    it('advises loading the sources separately', () => {
      const suggestions = suggestionsOf(
        catchError(() =>
          TransactionCatalog.fromThymianFormat(
            openApiShapedFormat(twoDescriptions),
          ),
        ),
      ).join('\n');

      expect(suggestions).toContain('Load the sources separately');
      expect(suggestions).not.toContain('same source');
    });
  });

  /**
   * The other half of the guard: the same-source branch must still be reachable
   * through the producer-faithful shape, or the fix would just be "always say
   * cross-source".
   */
  it('keeps the same-source advice when one description collides with itself', () => {
    const format = openApiShapedFormat([
      { source: 'only-source', responseDescription: 'Lists users.' },
      { source: 'only-source', responseDescription: 'Lists users, again.' },
    ]);

    expect(format.getThymianHttpTransactions()).toHaveLength(2);

    const suggestions = suggestionsOf(
      catchError(() => TransactionCatalog.fromThymianFormat(format)),
    ).join('\n');

    expect(suggestions).toContain('same source');
    expect(suggestions).not.toContain('Load the sources separately');
  });

  /**
   * `thymianRequestToOrigin` runs `normalizeUrl`, which throws `InvalidUrlError`
   * for an empty host — an OpenAPI `servers` entry like `file:///tmp/api`
   * produces one. That must not replace the collision the user needs.
   */
  it('still reports the collision when an origin cannot be normalized', () => {
    const error = catchError(() =>
      TransactionCatalog.fromThymianFormat(
        formatFrom([
          {
            method: 'GET',
            path: '/users',
            status: 200,
            host: '',
            source: 'source-one',
          },
          {
            method: 'GET',
            path: '/users',
            status: 200,
            host: 'api.two.example',
            source: 'source-two',
          },
        ]),
      ),
    );

    expect(error.name).toBe('SelectorCollisionError');
    expect(suggestionsOf(error)[0]).toBe('Source "source-one" describes it.');
    expect(suggestionsOf(error)[1]).toContain('http://api.two.example:8080');
  });

  it('reports a dangling but well-formed selector with near-miss suggestions', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));
    const dangling = 'GET /launches -> 418 (application/json)';

    const error = catchError(() => catalog.resolve(dangling));

    expect(error.name).toBe('UnknownSelectorError');
    expect(error.message).toContain(dangling);
    expect(suggestionsOf(error).join('\n')).toContain(
      'GET /launches -> 200 (application/json)',
    );
    expect(catalog.tryResolve(dangling)).toBeUndefined();
  });

  it('ranks same-method candidates before same-path candidates and caps at five', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        { method: 'POST', path: '/launches', status: 201 },
        { method: 'GET', path: '/launches', status: 200 },
        { method: 'GET', path: '/launches', status: 404 },
        { method: 'GET', path: '/launches', status: 500 },
        { method: 'GET', path: '/launches', status: 503 },
        { method: 'GET', path: '/launches', status: 502 },
        { method: 'GET', path: '/other', status: 200 },
      ]),
    );

    const error = catchError(() => catalog.resolve('GET /launches -> 418'));

    // The whole suggestion list, in order — not a pre-filtered slice of it, so
    // deleting the path filter or the ranking in `nearMisses` fails here.
    expect(suggestionsOf(error)).toEqual([
      'Did you mean one of these selectors?',
      '"GET /launches -> 200"',
      '"GET /launches -> 404"',
      '"GET /launches -> 500"',
      '"GET /launches -> 503"',
      '"GET /launches -> 502"',
    ]);
  });

  it('lists same-path candidates under another method after the same-method ones', () => {
    const catalog = TransactionCatalog.fromThymianFormat(
      formatFrom([
        { method: 'POST', path: '/launches', status: 201 },
        { method: 'GET', path: '/launches', status: 200 },
        { method: 'DELETE', path: '/launches', status: 204 },
      ]),
    );

    const error = catchError(() => catalog.resolve('GET /launches -> 418'));

    expect(suggestionsOf(error)).toEqual([
      'Did you mean one of these selectors?',
      '"GET /launches -> 200"',
      '"POST /launches -> 201"',
      '"DELETE /launches -> 204"',
    ]);
  });

  it('omits the candidate list when nothing shares the path', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    const error = catchError(() => catalog.resolve('GET /nowhere -> 200'));

    expect(error.name).toBe('UnknownSelectorError');
    expect(suggestionsOf(error)).toEqual([
      'Check the path against the loaded API description — no transaction with that path is loaded.',
    ]);
  });

  /**
   * With nothing loaded at all, "no transaction with that path is loaded" sends
   * the user after a path typo that is not the problem.
   */
  it('says nothing is loaded when the catalog is empty', () => {
    const catalog = TransactionCatalog.fromThymianFormat(new ThymianFormat());

    expect(catalog.size).toBe(0);

    const error = catchError(() => catalog.resolve('GET /launches -> 200'));

    expect(error.name).toBe('UnknownSelectorError');
    expect(suggestionsOf(error).join('\n')).toContain(
      'No transactions are loaded',
    );
    expect(suggestionsOf(error).join('\n')).not.toContain(
      'no transaction with that path',
    );
  });

  it('throws MalformedSelectorError for input that is not a selector', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    expect(
      catchError(() =>
        catalog.resolve('GET /launches - application/json → 200 OK'),
      ).name,
    ).toBe('MalformedSelectorError');
    expect(
      catalog.tryResolve('GET /launches - application/json → 200 OK'),
    ).toBeUndefined();
  });

  /**
   * A hand-authored selector that forgets the leading slash is not a selector,
   * and the diagnostic has to say so *and* show the canonical spelling — not
   * fall through to the least useful "no transaction with that path" line.
   */
  it('suggests the canonical spelling for a path without a leading slash', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    const error = catchError(() => catalog.resolve('GET launches -> 200'));

    expect(error.name).toBe('MalformedSelectorError');
    expect(suggestionsOf(error).join('\n')).toContain(
      'Did you mean "GET /launches -> 200"?',
    );
    expect(catalog.tryResolve('GET launches -> 200')).toBeUndefined();
  });

  it('returns undefined from selectorFor for an unknown transaction id', () => {
    const catalog = TransactionCatalog.fromThymianFormat(formatFrom(baseSpecs));

    expect(catalog.selectorFor('not-a-transaction-id')).toBeUndefined();
  });

  it('never reaches the filesystem or the samples tree', () => {
    const directory = fileURLToPath(
      new URL('../../src/selectors/', import.meta.url),
    );
    const files = readdirSync(directory, {
      recursive: true,
      withFileTypes: true,
    }).filter((entry) => entry.isFile() && entry.name.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(`${file.parentPath}/${file.name}`, 'utf-8');

      expect(source, file.name).not.toMatch(/\bnode:fs\b/);
      expect(source, file.name).not.toMatch(/\bfs\/promises\b/);
      expect(source, file.name).not.toMatch(/samples-structure/);
    }
  });
});
