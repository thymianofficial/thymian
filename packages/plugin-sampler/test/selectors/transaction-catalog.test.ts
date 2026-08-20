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

/**
 * The advice a collision carries, verbatim and unconditional. Every collision
 * gets exactly these three lines, so each case below pins the whole tail rather
 * than a phrase: that is what makes a reintroduced same-source/cross-source
 * branch fail here instead of passing whichever fixture happens to agree with
 * it.
 *
 * There is no branch because there is nothing sound to branch on. A source
 * *name* is not a source identity: `sourceName` defaults to
 * `document.info.title`
 * (`plugin-openapi/src/processors/openapi.processor.ts:204`) and the config
 * never requires an explicit one, so two documents may share one, carry an
 * empty one, or carry none at all. Three name-based discriminators were tried —
 * the edge name, the union of edge/request/response names, and the response
 * name alone — and each emitted the inverse advice for some reachable shape.
 */
const COLLISION_ADVICE = [
  'A selector is host-stripped and carries no query parameters or headers, so two transactions collide whenever they agree on method, path, status and media types — whether they come from one description or two.',
  'If the two lines above point at different documents, load those sources separately — a source-discriminator syntax does not exist.',
  'If they point at one document, give the two operations distinct paths, methods, statuses or media types.',
];

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
      // Also on the response node, which is where `plugin-openapi` puts it
      // (`openapi.processor.ts:161-175`) and the only carrier a diagnostic may
      // read it from: a request node is deduped across sources.
      ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
    });

    format.addHttpTransaction(request, response, source);
  }

  return format;
}

type OpenApiShapedSpec = {
  /**
   * The description's `info.title`, which is what `sourceName` defaults to
   * (`plugin-openapi/src/processors/openapi.processor.ts:204`). Every value it
   * can really take has to be expressible here, because a source *name* is not
   * a source identity: two documents may share one, a document may carry an
   * empty one, and `undefined` models a document with **no** `info.title` at
   * all — schema validation only *warns* about the missing key, so the load
   * proceeds.
   */
  source?: string;
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
    // The cast reproduces the type violation a real load carries: `sourceName`
    // is typed `string`, but it is filled from `document.info.title`, which is
    // `undefined` when the key is absent.
    const sourceName = spec.source as string;

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
      sourceName,
    });

    format.addResponseToRequest(
      reqId,
      {
        ...createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          description: spec.responseDescription,
        }),
        sourceName,
        ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
      },
      {
        sourceName,
        ...(spec.sourceLocation ? { sourceLocation: spec.sourceLocation } : {}),
      },
    );
  }

  return format;
}

/**
 * The shape in which a *foreign* source owns the deduped request node.
 *
 * `Service A` declares `GET /v1/pets` with only a `404`, so it creates the
 * request node; `Service B` declares the same request, dedupes into A's node,
 * and then collides with itself on `200 (application/json)`. Core resolves an
 * edge's name as `sourceName ?? req.sourceName`
 * (`core/src/format/thymian-format.ts:233`), so **every** edge here reports
 * `Service A` while both colliding response nodes report `Service B` — a
 * single-description collision that any name-pooling discriminator reads as
 * cross-source, and whose "load the sources separately" remedy cannot be
 * followed: loading `Service B` alone still collides.
 */
function foreignRequestOwnerFormat(): ThymianFormat {
  const format = new ThymianFormat();
  const request = createHttpRequest({
    method: 'GET',
    path: '/v1/pets',
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    mediaType: '',
  });

  format.addResponseToRequest(
    format.addRequest({ ...request, sourceName: 'Service A' }),
    {
      ...createHttpResponse({ statusCode: 404, mediaType: '' }),
      sourceName: 'Service A',
    },
    { sourceName: 'Service A' },
  );

  for (const description of ['Lists pets.', 'Lists pets, again.']) {
    format.addResponseToRequest(
      format.addRequest({ ...request, sourceName: 'Service B' }),
      {
        ...createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
          description,
        }),
        sourceName: 'Service B',
      },
      { sourceName: 'Service B' },
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
    expect(suggestionsOf(error).slice(2)).toEqual(COLLISION_ADVICE);
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

  });

  /**
   * A collision reaches the user as three lines of advice that never claim
   * which kind of collision it is, above two lines that print the evidence.
   * Each case below is a shape that broke a previous, classifying message; all
   * of them assert the SAME tail, and what varies is only the naming and the
   * location pointer the reader classifies from.
   */
  describe('the collision advice', () => {
    function adviceFor(format: ThymianFormat): string[] {
      return suggestionsOf(
        catchError(() => TransactionCatalog.fromThymianFormat(format)),
      );
    }

    /**
     * Reachable from a single valid document: node identity ignores only
     * `label`, `sourceLocation` and `sourceName`, so two operations that differ
     * in anything a selector does not carry — a description, a query parameter,
     * a header, `bodyRequired`, or a base path re-added by an operation-level
     * `servers` override — arrive as two transactions and collide. Round 1
     * rejected telling that user to "load the sources separately"; the advice
     * now offers that remedy conditionally, beside the one they can follow.
     */
    it('is the same for one description colliding with itself', () => {
      const format = openApiShapedFormat([
        {
          source: 'only-source',
          responseDescription: 'Lists users.',
          sourceLocation: {
            path: 's.yaml',
            position: { line: 6, column: 5, offset: 42 },
          },
        },
        {
          source: 'only-source',
          responseDescription: 'Lists users, again.',
          sourceLocation: {
            path: 's.yaml',
            position: { line: 15, column: 5, offset: 99 },
          },
        },
      ]);

      expect(format.getThymianHttpTransactions()).toHaveLength(2);

      const suggestions = adviceFor(format);

      expect(suggestions.slice(0, 2)).toEqual([
        'Source "only-source" describes it at http://localhost:8080 (s.yaml:6:5).',
        'Source "only-source" describes it at http://localhost:8080 (s.yaml:15:5).',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });

    /**
     * The shape no name-based discriminator can see, and the flagship
     * cross-source cause the reference page itself names: a staging and a
     * production description of one API share an `info.title`, so `sourceName`
     * is identical on both sides while the two transactions come from two
     * files. Only the quoted locations tell them apart — which is exactly why
     * the message must not decide for the reader.
     */
    it('is the same for two documents that share an info.title', () => {
      const format = openApiShapedFormat([
        {
          source: 'Petstore API',
          responseDescription: 'The staging users.',
          sourceLocation: {
            path: 'staging.yaml',
            position: { line: 8, column: 7, offset: 61 },
          },
        },
        {
          source: 'Petstore API',
          responseDescription: 'The production users.',
          sourceLocation: {
            path: 'production.yaml',
            position: { line: 12, column: 7, offset: 88 },
          },
        },
      ]);

      expect(format.getThymianHttpTransactions()).toHaveLength(2);

      const suggestions = adviceFor(format);

      // One name, two documents: the pair a name-based test reads as "same
      // source" and the locations read as two.
      expect(suggestions.slice(0, 2)).toEqual([
        'Source "Petstore API" describes it at http://localhost:8080 (staging.yaml:8:7).',
        'Source "Petstore API" describes it at http://localhost:8080 (production.yaml:12:7).',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });

    /**
     * An empty `info.title` used to be filtered out of the name pool, so an
     * unnamed source could never disagree with anything and the pool collapsed
     * to one name. It is now named as what it is, and keeps its own location.
     */
    it('is the same when one description carries an empty info.title', () => {
      const suggestions = adviceFor(
        openApiShapedFormat([
          {
            source: '',
            responseDescription: 'The unnamed users.',
            sourceLocation: {
              path: 'unnamed.yaml',
              position: { line: 4, column: 3, offset: 20 },
            },
          },
          {
            source: 'Petstore API',
            responseDescription: 'The named users.',
            sourceLocation: {
              path: 'named.yaml',
              position: { line: 9, column: 5, offset: 70 },
            },
          },
        ]),
      );

      expect(suggestions.slice(0, 2)).toEqual([
        'An unnamed source describes it at http://localhost:8080 (unnamed.yaml:4:3).',
        'Source "Petstore API" describes it at http://localhost:8080 (named.yaml:9:5).',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });

    /**
     * `info.title` is required by the OpenAPI schema, but validation only
     * *warns*, so a document without it loads and `sourceName` arrives
     * `undefined`. Filtering the names on `.length` turned that into a raw
     * `TypeError` and destroyed the diagnostic outright — the one thing a
     * collision error must never do.
     */
    it('is the same when no description carries an info.title', () => {
      const error = catchError(() =>
        TransactionCatalog.fromThymianFormat(
          openApiShapedFormat([
            {
              responseDescription: 'The A users.',
              sourceLocation: {
                path: 'a.yaml',
                position: { line: 5, column: 3, offset: 30 },
              },
            },
            {
              responseDescription: 'The B users.',
              sourceLocation: {
                path: 'b.yaml',
                position: { line: 7, column: 3, offset: 44 },
              },
            },
          ]),
        ),
      );

      expect(error.name).toBe('SelectorCollisionError');
      expect(error.message).toContain('GET /users -> 200 (application/json)');

      const suggestions = suggestionsOf(error);

      expect(suggestions.slice(0, 2)).toEqual([
        'An unnamed source describes it at http://localhost:8080 (a.yaml:5:3).',
        'An unnamed source describes it at http://localhost:8080 (b.yaml:7:3).',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });

    /**
     * Every source name empty inside ONE document: the name pool was empty, its
     * size was 0 rather than 1, and the collision was told to load its sources
     * separately. The locations are the only discriminator here, so they have
     * to survive being unnamed.
     */
    it('is the same when every source name in one document is empty', () => {
      const suggestions = adviceFor(
        openApiShapedFormat([
          {
            source: '',
            responseDescription: 'Lists users.',
            sourceLocation: {
              path: 's.yaml',
              position: { line: 6, column: 5, offset: 42 },
            },
          },
          {
            source: '',
            responseDescription: 'Lists users, again.',
            sourceLocation: {
              path: 's.yaml',
              position: { line: 15, column: 5, offset: 99 },
            },
          },
        ]),
      );

      expect(suggestions.slice(0, 2)).toEqual([
        'An unnamed source describes it at http://localhost:8080 (s.yaml:6:5).',
        'An unnamed source describes it at http://localhost:8080 (s.yaml:15:5).',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });

    /**
     * A foreign source owns the deduped request node, with no empty name
     * anywhere: the pooled names were `{Service A, Service B}` while the
     * collision sat entirely inside `Service B`, so the advice named two
     * sources and told the user to separate something that still collides on
     * its own.
     */
    it('is the same when a foreign source owns the deduped request node', () => {
      const format = foreignRequestOwnerFormat();
      const transactions = format.getThymianHttpTransactions();

      expect(transactions).toHaveLength(3);
      expect(new Set(transactions.map((t) => t.thymianReqId)).size).toBe(1);
      expect(transactions.map((t) => t.transaction.sourceName)).toEqual([
        'Service A',
        'Service A',
        'Service A',
      ]);

      const suggestions = adviceFor(format);

      expect(suggestions.slice(0, 2)).toEqual([
        'Source "Service B" describes it at http://localhost:8080.',
        'Source "Service B" describes it at http://localhost:8080.',
      ]);
      expect(suggestions.slice(2)).toEqual(COLLISION_ADVICE);
    });
  });

  /**
   * The name and the location must come off ONE carrier. Core rewrites an
   * edge's `sourceName` to the deduped request node's
   * (`thymian-format.ts:233`) but leaves the producer's `sourceLocation`
   * untouched, so pairing a name from one carrier with a location from another
   * printed source A's name over source B's file.
   */
  it('never quotes one source name against another source location', () => {
    const suggestions = suggestionsOf(
      catchError(() =>
        TransactionCatalog.fromThymianFormat(
          openApiShapedFormat([
            {
              source: 'Petstore A',
              responseDescription: 'The A users.',
              sourceLocation: {
                path: 'a.yaml',
                position: { line: 6, column: 5, offset: 42 },
              },
            },
            {
              source: '',
              responseDescription: 'The B users.',
              sourceLocation: {
                path: 'b2.yaml',
                position: { line: 9, column: 5, offset: 70 },
              },
            },
          ]),
        ),
      ),
    );

    expect(suggestions[0]).toBe(
      'Source "Petstore A" describes it at http://localhost:8080 (a.yaml:6:5).',
    );
    expect(suggestions[1]).toBe(
      'An unnamed source describes it at http://localhost:8080 (b2.yaml:9:5).',
    );
    expect(suggestions[1]).not.toContain('Petstore A');
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
