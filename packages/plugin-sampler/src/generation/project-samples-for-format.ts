import type { ThymianEmitter, ThymianFormat } from '@thymian/core';

import type { HttpRequestSample } from '../http-request-sample.js';
import { generateRequestSampleForTransaction } from './generate-request-sample.js';

/**
 * Project a loaded format into one in-memory sample per transaction.
 *
 * This is the whole of the v2 sampling path: `core.request.sample` answers from
 * this map, so no samples tree is ever read from disk and none is written. That
 * is the boundary the spec draws — not "no disk access at all":
 * `ImageContentTypeStrategy` still reads the placeholder asset shipped inside
 * the package for `image/*` bodies, which is a constant of the build, not a
 * baseline a sample could drift from.
 *
 * Keyed on `transaction.transactionId`, the same key the format itself uses.
 * Deliberately uncached across loads: the projection is rebuilt on every
 * `core.format`, which is what makes a stale sample structurally impossible.
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
