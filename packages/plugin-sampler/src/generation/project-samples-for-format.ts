import type { ThymianEmitter, ThymianFormat } from '@thymian/core';

import type { HttpRequestSample } from '../http-request-sample.js';
import { generateRequestSampleForTransaction } from './generate-request-sample.js';

/**
 * Project the loaded format into an in-memory sample per transaction.
 *
 * This is the runtime sampling path: `core.request.sample` answers from this map,
 * so nothing a sample is built from is ever read from disk. Keyed on
 * `transaction.transactionId` — the same key the format, the request sampler and
 * the v1 hook map all use.
 *
 * Deliberately uncached: the projection is rebuilt on every `core.format`, which is
 * what makes a stale sample structurally impossible.
 */
export async function projectSamplesForThymianFormat(
  format: ThymianFormat,
  emitter: ThymianEmitter,
): Promise<Map<string, HttpRequestSample>> {
  const samples = new Map<string, HttpRequestSample>();

  for (const transaction of format.getThymianHttpTransactions()) {
    samples.set(
      transaction.transactionId,
      await generateRequestSampleForTransaction(format, transaction, emitter),
    );
  }

  return samples;
}
