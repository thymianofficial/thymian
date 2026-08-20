import { ThymianEmitter } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestSampler } from '../src/request-sampler.js';

/**
 * Records every path handed to `node:fs/promises` so the tests can assert that
 * building and querying a sampler never touches a samples tree on disk (AC1).
 * The real implementations are kept — image content sources legitimately read
 * the package's own static assets.
 */
const touchedPaths: string[] = [];

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();

  return new Proxy(actual, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        for (const arg of args) {
          if (typeof arg === 'string') {
            touchedPaths.push(arg);
          }
        }

        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
});

const format = createThymianFormatWithTransactions(5);

describe('RequestSampler', () => {
  beforeEach(() => {
    touchedPaths.length = 0;
  });

  it('resolves a sample for every transaction in the format', async () => {
    const sampler = new RequestSampler();

    await sampler.init(format, new ThymianEmitter());

    for (const transaction of format.getThymianHttpTransactions()) {
      const sample = sampler.sampleForTransaction(transaction.transactionId);

      // Asserting against the originating transaction, not just `toBeDefined()`:
      // the fixture's paths are distinct, so an implementation that answered every
      // id with `transactions[0]`'s sample would pass a definedness check and fail
      // here. This is AC1's central invariant.
      expect(sample).toBeDefined();
      expect(sample?.method).toBe(transaction.thymianReq.method);
      expect(sample?.path).toBe(transaction.thymianReq.path);
    }
  }, 30_000);

  it('returns undefined for a transaction id that is not in the projection', async () => {
    const sampler = new RequestSampler();

    await sampler.init(format, new ThymianEmitter());

    expect(
      sampler.sampleForTransaction('not-a-transaction-id'),
    ).toBeUndefined();
  }, 30_000);

  it('never reads a samples tree from disk', async () => {
    const sampler = new RequestSampler();

    await sampler.init(format, new ThymianEmitter());

    for (const transaction of format.getThymianHttpTransactions()) {
      expect(
        sampler.sampleForTransaction(transaction.transactionId),
      ).toBeDefined();
    }

    expect(touchedPaths.filter((path) => path.includes('.thymian'))).toEqual(
      [],
    );
    expect(touchedPaths.filter((path) => path.includes('meta.json'))).toEqual(
      [],
    );
  }, 30_000);

  it('rebuilds the projection when a new format is loaded', async () => {
    const sampler = new RequestSampler();
    const emitter = new ThymianEmitter();

    await sampler.init(format, emitter);

    // The second format must be built from transactions DISJOINT from the first.
    // `createThymianFormatWithTransactions(n)` numbers its paths from 0 and
    // `transactionId` is a content hash, so `createThymianFormatWithTransactions(2)`
    // would produce a strict SUBSET of `format`'s ids — every lookup below would
    // then be answered by the first projection and the test could not fail.
    const otherFormat = createThymianFormatWithTransactions([
      [
        createHttpRequest({ path: '/other-transaction-0' }),
        createHttpResponse(),
      ],
      [
        createHttpRequest({ path: '/other-transaction-1' }),
        createHttpResponse(),
      ],
    ]);

    const otherFormatIds = otherFormat
      .getThymianHttpTransactions()
      .map((transaction) => transaction.transactionId);
    const idsOnlyInFirstFormat = format
      .getThymianHttpTransactions()
      .map((transaction) => transaction.transactionId)
      .filter((id) => !otherFormatIds.includes(id));

    // Guards the disjointness the assertions below rely on.
    expect(idsOnlyInFirstFormat.length).toBeGreaterThan(0);

    for (const id of idsOnlyInFirstFormat) {
      expect(sampler.sampleForTransaction(id)).toBeDefined();
    }

    await sampler.init(otherFormat, emitter);

    for (const id of otherFormatIds) {
      expect(sampler.sampleForTransaction(id)).toBeDefined();
    }

    // The projection is REPLACED, not merged. This is the assertion that bites:
    // it is the only thing in the suite that fails if `init` ever caches or
    // early-returns instead of rebuilding — the staleness a `format.toHash()`
    // cache would reintroduce.
    for (const id of idsOnlyInFirstFormat) {
      expect(sampler.sampleForTransaction(id)).toBeUndefined();
    }
  }, 30_000);
});
