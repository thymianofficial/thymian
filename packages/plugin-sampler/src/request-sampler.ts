import {
  type ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';

import { generateRequestSampleForTransaction } from './generation/generate-request-sample.js';
import { projectSamplesForThymianFormat } from './generation/project-samples-for-format.js';
import type { HttpRequestSample } from './http-request-sample.js';

/**
 * The sampler's answer to "what request should this transaction send?".
 *
 * Holds the in-memory projection of the currently loaded format and nothing
 * else. There is no version, no timestamp and no baseline to compare against,
 * because there is no artifact that could disagree with the format: {@link load}
 * throws the previous projection away and rebuilds it.
 */
export class RequestSampler {
  #samples: Map<string, HttpRequestSample> = new Map();
  #format: ThymianFormat = new ThymianFormat();

  /** Project `format` in full, replacing any previous projection. */
  async load(format: ThymianFormat, emitter: ThymianEmitter): Promise<void> {
    this.#format = format;
    this.#samples = await projectSamplesForThymianFormat(format, emitter);
  }

  /**
   * The sample for one transaction.
   *
   * A transaction the projection has not seen is generated on the spot rather
   * than reported as missing: generation is a pure function of the transaction,
   * so an unprojected transaction is one nobody has asked for yet, not evidence
   * that something on disk is out of date. Before any format is loaded the
   * stand-in empty format answers `requestIsSecured` with `false` — the same
   * answer an unsecured operation gets, and harmless because authorization is
   * additionally gated on a registered authorize hook.
   */
  async sampleForTransaction(
    transaction: ThymianHttpTransaction,
    emitter: ThymianEmitter,
  ): Promise<HttpRequestSample> {
    const projected = this.#samples.get(transaction.transactionId);

    if (projected) {
      return projected;
    }

    const generated = await generateRequestSampleForTransaction(
      this.#format,
      transaction,
      emitter,
    );

    this.#samples.set(transaction.transactionId, generated);

    return generated;
  }
}
