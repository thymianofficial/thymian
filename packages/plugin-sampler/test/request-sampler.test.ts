import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
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

    const otherFormat = createThymianFormatWithTransactions(2);

    await sampler.init(otherFormat, emitter);

    for (const transaction of otherFormat.getThymianHttpTransactions()) {
      expect(
        sampler.sampleForTransaction(transaction.transactionId),
      ).toBeDefined();
    }
  }, 30_000);
});
