import {
  type HttpRequestTemplate,
  type ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';

import { generateRequestSampleForTransaction } from './generation/generate-request-sample.js';
import type { HttpRequestSample } from './http-request-sample.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';

/**
 * Shapes the request a Transaction will send, at generation time. The
 * `defineSample` hook, seen from here.
 */
export type SampleShaper = (
  draft: HttpRequestTemplate,
  transactionId: string,
) => Promise<void>;

/**
 * The sampler's answer to "what request should this transaction send?".
 *
 * Holds the in-memory projection of the currently loaded format and nothing
 * else. There is no version, no timestamp and no baseline to compare against,
 * because there is no artifact that could disagree with the format: {@link load}
 * throws the previous projection away and rebuilds it.
 */
export class RequestSampler {
  private samples: Map<string, HttpRequestSample> = new Map();
  private format: ThymianFormat = new ThymianFormat();
  private shape: SampleShaper | undefined;

  /**
   * Project `format` in full, replacing any previous projection.
   *
   * `shape` is applied per reply rather than baked into the projection, which is
   * where the pipeline puts it — "generate base sample, then `defineSample`" —
   * and it is also what keeps a `defineSample` hook from running for
   * Transactions nobody asks about.
   */
  async load(
    format: ThymianFormat,
    emitter: ThymianEmitter,
    shape?: SampleShaper,
  ): Promise<void> {
    this.format = format;
    this.shape = shape;
    this.samples = new Map();

    for (const transaction of format.getThymianHttpTransactions()) {
      this.samples.set(
        transaction.transactionId,
        await generateRequestSampleForTransaction(format, transaction, emitter),
      );
    }
  }

  /**
   * The request for one transaction, as a value the caller owns.
   *
   * Every reply is a fresh deep copy. Hooks mutate the request in place, and an
   * inline content source hands its value out by reference, so returning the
   * projection itself let a `beforeEach` header land in what `sampler show`
   * printed afterwards — the projection is a projection of the description, and
   * nothing a run does may write back into it.
   *
   * A transaction the projection has not seen is generated on the spot rather
   * than reported as missing: generation is a pure function of the transaction,
   * so an unprojected transaction is one nobody has asked for yet, not evidence
   * that something on disk is out of date.
   */
  async sampleForTransaction(
    transaction: ThymianHttpTransaction,
    emitter: ThymianEmitter,
  ): Promise<HttpRequestTemplate> {
    let sample = this.samples.get(transaction.transactionId);

    if (!sample) {
      sample = await generateRequestSampleForTransaction(
        this.format,
        transaction,
        emitter,
      );

      this.samples.set(transaction.transactionId, sample);
    }

    const draft = structuredClone(requestSampleToRequestTemplate(sample));

    await this.shape?.(draft, transaction.transactionId);

    return draft;
  }
}
