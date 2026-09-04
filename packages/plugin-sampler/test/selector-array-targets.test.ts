import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { compileHook } from './compile-probe.js';

/**
 * #49: a hook targeting an array of Selectors gets the **union** of those
 * Transactions' types — the same safety a single Selector gets, distributed
 * over the array's members. Only a filter falls back to the generic context.
 */
const CREATE = 'POST /launches (application/json) -> 201 (application/json)';
const CREATE_CREW =
  'POST /launches/{id}/crew (application/json) -> 201 (application/json)';

const FIXTURE = (() => {
  const format = new ThymianFormat();

  format.addHttpTransaction(
    createHttpRequest({
      method: 'POST',
      path: '/launches',
      mediaType: 'application/json',
      body: {
        type: 'object',
        // Closed on purpose: an open object grows an index signature, and every
        // property becomes readable as `unknown` — which would make "this
        // property belongs to the other transaction" unprovable.
        additionalProperties: false,
        required: ['name'],
        properties: { name: { type: 'string' }, pad: { type: 'string' } },
      } as never,
      bodyRequired: true,
    }),
    createHttpResponse({
      statusCode: 201,
      schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      } as never,
    }),
    'test-source',
  );
  format.addHttpTransaction(
    createHttpRequest({
      method: 'POST',
      path: '/launches/{id}/crew',
      mediaType: 'application/json',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: { name: { type: 'string' }, rank: { type: 'string' } },
      } as never,
      bodyRequired: true,
    }),
    createHttpResponse({
      statusCode: 201,
      schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      } as never,
    }),
    'test-source',
  );

  return format;
})();

const CATALOG = TransactionCatalog.fromThymianFormat(FIXTURE);
const TARGET = `[${JSON.stringify(CREATE)}, ${JSON.stringify(CREATE_CREW)}]`;

describe('a hook targeting an array of selectors', () => {
  it('sees the union of the two requests, and narrows on a discriminant', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${TARGET}, (request) => {
  // Common to both members, so it is readable and writable on the union.
  request.headers['x-trace'] = 'yes';
  request.authorize = true;

  // \`path\` is a literal per member, so it discriminates.
  if (request.path === '/launches/{id}/crew') {
    request.pathParameters['id'] = 'l-1';
    request.body.rank = 'commander';
  } else {
    request.body.pad = 'LC-39A';
  }
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('rejects a property only one of the two transactions has', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${TARGET}, (request) => {
  request.body.rank = 'commander';
});
`,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toContain('rank');
  });

  it('rejects a path that belongs to neither', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${TARGET}, (request) => {
  request.path = '/nope';
});
`,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toContain("'/nope'");
  });

  it('sees the union of the two responses in afterEach', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { afterEach } from '@thymian/hooks';

export const observe = afterEach(${TARGET}, (response, ctx, utils) => {
  const status: 201 = response.statusCode;

  utils.info(String(status) + String(response.duration));
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('sees the union of the two drafts in defineSample', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { defineSample } from '@thymian/hooks';

export const shape = defineSample(${TARGET}, (draft) => {
  draft.body.name = 'Artemis';

  if (draft.path === '/launches') {
    draft.body.pad = 'LC-39A';
  }
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('keeps a single-selector array as precise as the selector itself', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach([${JSON.stringify(CREATE)}], (request) => {
  request.body.pad = 'LC-39A';
});
`,
    );

    expect(diagnostics).toEqual([]);
  });
});

describe('a hook targeting a filter', () => {
  it('keeps the generic context, where a body is unknown', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach({ method: 'POST' }, (request) => {
  request.headers['x-trace'] = 'yes';
  request.body = { name: 'Artemis' };
});
`,
    );

    expect(diagnostics).toEqual([]);
  });

  it('still rejects a filter value the description does not have', async () => {
    const diagnostics = await compileHook(
      CATALOG,
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach({ method: 'TRACE' }, (request) => {
  request.headers['x-trace'] = 'yes';
});
`,
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toContain('TRACE');
  });
});
