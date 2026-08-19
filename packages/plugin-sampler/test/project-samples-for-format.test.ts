import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { projectSamplesForThymianFormat } from '../src/generation/project-samples-for-format.js';

const format = createThymianFormatWithTransactions(20);

describe('projectSamplesForThymianFormat', () => {
  it('projects exactly one sample per transaction, keyed by transactionId', async () => {
    const projection = await projectSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    const transactions = format.getThymianHttpTransactions();

    expect(transactions.length).toBeGreaterThan(0);
    expect(projection.size).toBe(transactions.length);

    // The fixture gives every transaction a distinct path, which is what makes the
    // per-transaction assertions below discriminating: an implementation that keyed
    // the map correctly but generated every sample from `transactions[0]` would pass
    // a bare `toBeDefined()` check and fail this one.
    expect(new Set(transactions.map((t) => t.thymianReq.path)).size).toBe(
      transactions.length,
    );

    for (const transaction of transactions) {
      const sample = projection.get(transaction.transactionId);

      expect(sample).toBeDefined();
      expect(sample?.method).toBe(transaction.thymianReq.method);
      expect(sample?.path).toBe(transaction.thymianReq.path);
    }
  }, 30_000);

  it('is deterministic — projecting the same format twice is deeply equal', async () => {
    const first = await projectSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );
    const second = await projectSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    expect([...second.keys()]).toEqual([...first.keys()]);
    expect([...second.entries()]).toEqual([...first.entries()]);
  }, 30_000);

  it('mirrors the iteration order of the format transactions', async () => {
    const projection = await projectSamplesForThymianFormat(
      format,
      new ThymianEmitter(),
    );

    expect([...projection.keys()]).toEqual(
      format.getThymianHttpTransactions().map((t) => t.transactionId),
    );
  }, 30_000);
});
