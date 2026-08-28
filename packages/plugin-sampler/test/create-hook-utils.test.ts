import type { HttpRequest, HttpResponse } from '@thymian/core';
import { thymianHttpRequestToUrl } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createMockLogger,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRequestKeyIndex,
  createHookUtils,
} from '../src/hooks/create-hook-utils.js';
import type { HookRunner } from '../src/hooks/hook-runner.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';

/**
 * One request with three responses, plus a request that has no 2xx at all — the
 * two shapes the v1 `meta.transactions` key semantics distinguish.
 */
const format = createThymianFormatWithTransactions([
  [
    createHttpRequest({ path: '/orders' }),
    createHttpResponse({ statusCode: 404 }),
  ],
  [
    createHttpRequest({ path: '/orders' }),
    createHttpResponse({ statusCode: 201 }),
  ],
  [
    createHttpRequest({ path: '/orders' }),
    createHttpResponse({ statusCode: 200 }),
  ],
  [
    createHttpRequest({ path: '/legacy' }),
    createHttpResponse({ statusCode: 500 }),
  ],
]);

const catalog = TransactionCatalog.fromThymianFormat(format);

function idFor(path: string, statusCode: number): string {
  const found = format
    .getThymianHttpTransactions()
    .find(
      (candidate) =>
        candidate.thymianReq.path === path &&
        candidate.thymianRes.statusCode === statusCode,
    );

  if (!found) {
    throw new Error(`fixture must carry ${path} -> ${statusCode}`);
  }

  return found.transactionId;
}

function keyFor(path: string): string {
  const found = format
    .getThymianHttpTransactions()
    .find((candidate) => candidate.thymianReq.path === path);

  if (!found) {
    throw new Error(`fixture must carry ${path}`);
  }

  return `${found.thymianReq.method.toUpperCase()} ${thymianHttpRequestToUrl(
    found.thymianReq,
  )}`;
}

describe('buildRequestKeyIndex', () => {
  const resolve = buildRequestKeyIndex(catalog);

  it('serves the v1 key format from the loaded format, with no samples tree', () => {
    expect(resolve(`${keyFor('/orders')}->201`)).toBe(idFor('/orders', 201));
    expect(resolve(`${keyFor('/orders')}->404`)).toBe(idFor('/orders', 404));
    expect(resolve(`${keyFor('/legacy')}->500`)).toBe(idFor('/legacy', 500));
  });

  it('maps the bare key to the lowest 2xx response, as v1 did', () => {
    // Written 404, 201, 200 — so "the first 2xx encountered" would answer 201.
    expect(resolve(keyFor('/orders'))).toBe(idFor('/orders', 200));
  });

  it('leaves the bare key unresolved when a request has no 2xx response', () => {
    expect(resolve(keyFor('/legacy'))).toBeUndefined();
  });

  it('returns undefined for a key nothing declares', () => {
    expect(resolve('GET https://localhost/nope')).toBeUndefined();
    expect(resolve(`${keyFor('/orders')}->418`)).toBeUndefined();
    expect(resolve('')).toBeUndefined();
  });

  it('rebuilds per catalog rather than caching across loads', () => {
    const other = createThymianFormatWithTransactions([
      [createHttpRequest({ path: '/other' }), createHttpResponse()],
    ]);
    const otherResolve = buildRequestKeyIndex(
      TransactionCatalog.fromThymianFormat(other),
    );

    expect(otherResolve(keyFor('/orders'))).toBeUndefined();
  });
});

describe('utils.request and a stale transaction id', () => {
  function stubRunner() {
    return {
      beforeEachRequest: vi.fn(async (hook: { value: unknown }) => ({
        result: hook.value,
        testResults: [],
      })),
      authorize: vi.fn(async (hook: { value: unknown }) => ({
        result: hook.value,
        testResults: [],
      })),
      afterEachResponse: vi.fn(async (hook: { value: unknown }) => ({
        result: hook.value,
        testResults: [],
      })),
    };
  }

  const response: HttpResponse = {
    duration: 1,
    headers: {},
    statusCode: 200,
    trailers: {},
  };

  it('throws instead of dispatching with `source: undefined`', async () => {
    const runner = stubRunner();
    const runRequest = vi.fn(async (): Promise<HttpResponse> => response);

    const utils = createHookUtils(
      format,
      runRequest,
      runner as unknown as HookRunner,
      // A key that resolves to an id the format does not carry: exactly what a
      // lookup built against a different format produces.
      () => 'an-id-that-is-not-in-this-format',
      [],
      createMockLogger(),
    );

    await expect(
      utils.request(
        `GET ${thymianHttpRequestToUrl(createHttpRequest({ path: '/orders' }))}`,
        {
          body: undefined,
        },
      ),
    ).rejects.toMatchObject({ name: 'StaleTransactionIdError' });

    // The old behaviour was two silent wrong answers, not one loud one: hooks
    // were skipped because every entry point branches on `ctx?.transactionId`,
    // and then the request was serialized without its source.
    expect(runner.beforeEachRequest).not.toHaveBeenCalled();
    expect(runner.authorize).not.toHaveBeenCalled();
    expect(runRequest).not.toHaveBeenCalled();
  });

  it('still throws the missing-key error when nothing resolves at all', async () => {
    const utils = createHookUtils(
      format,
      async (): Promise<HttpResponse> => response,
      stubRunner() as unknown as HookRunner,
      () => undefined,
      [],
      createMockLogger(),
    );

    await expect(
      utils.request('GET https://localhost/nope', { body: undefined }),
    ).rejects.toThrow(/Could not find transaction ID/);
  });

  it('dispatches with the resolved transaction as the request source', async () => {
    const runner = stubRunner();
    const seen: HttpRequest[] = [];
    const runRequest = vi.fn(
      async (req: HttpRequest): Promise<HttpResponse> => {
        seen.push(req);
        return response;
      },
    );

    const resolve = buildRequestKeyIndex(catalog);
    const utils = createHookUtils(
      format,
      runRequest,
      runner as unknown as HookRunner,
      resolve,
      [],
      createMockLogger(),
    );

    const url = `GET ${thymianHttpRequestToUrl(createHttpRequest({ path: '/orders' }))}`;

    await utils.request(url, { body: undefined });

    expect(runRequest).toHaveBeenCalledTimes(1);
    expect(seen[0]?.path).toBe('/orders');
    // Hooks ran, which is only possible with a real transaction as ctx.
    expect(runner.beforeEachRequest).toHaveBeenCalledTimes(1);
    expect(
      (runner.beforeEachRequest.mock.calls[0]?.[0] as { ctx?: unknown }).ctx,
    ).toBeDefined();
  });
});
