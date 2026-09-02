import {
  type HttpRequestTemplate,
  type HttpTestCaseResult,
  type Logger,
  type ThymianEmitter,
  ThymianFormat,
  type ThymianHttpTransaction,
} from '@thymian/core';

import { generateRequestSampleForTransaction } from './generation/generate-request-sample.js';
import { createHookUtils } from './hooks/create-hook-utils.js';
import type { LoadUserHooksResult } from './hooks/load-user-hooks.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';

/**
 * The sampler's answer to "what request should this transaction send?".
 *
 * Holds the in-memory projection of the currently loaded format and nothing
 * else. There is no version, no timestamp and no baseline to compare against,
 * because there is no artifact that could disagree with the format: {@link load}
 * throws the previous projection away and rebuilds it.
 *
 * A projected entry is the request **after** its `defineSample` hook has shaped
 * it, so generation-time intent lives in the projection rather than being
 * re-applied per request. That is also why `sampler show` shows what will
 * actually be sent.
 */
export class RequestSampler {
  #templates: Map<string, HttpRequestTemplate> = new Map();
  #format: ThymianFormat = new ThymianFormat();
  #hooks: LoadUserHooksResult | undefined;

  constructor(
    private readonly runRequestForHooks: Parameters<typeof createHookUtils>[1],
    private readonly logger: Logger,
  ) {}

  /** Project `format` in full, replacing any previous projection. */
  async load(
    format: ThymianFormat,
    emitter: ThymianEmitter,
    hooks?: LoadUserHooksResult,
  ): Promise<void> {
    this.#format = format;
    this.#hooks = hooks;
    this.#templates = new Map();

    for (const transaction of format.getThymianHttpTransactions()) {
      this.#templates.set(
        transaction.transactionId,
        await this.generate(transaction, emitter),
      );
    }
  }

  /** How many transactions the current projection covers. */
  get size(): number {
    return this.#templates.size;
  }

  /**
   * The request for one transaction.
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
    const projected = this.#templates.get(transaction.transactionId);

    if (projected) {
      return projected;
    }

    const generated = await this.generate(transaction, emitter);

    this.#templates.set(transaction.transactionId, generated);

    return generated;
  }

  private async generate(
    transaction: ThymianHttpTransaction,
    emitter: ThymianEmitter,
  ): Promise<HttpRequestTemplate> {
    const sample = await generateRequestSampleForTransaction(
      this.#format,
      transaction,
      emitter,
    );
    const draft = requestSampleToRequestTemplate(sample);
    const define = this.#hooks?.byTransactionId.get(transaction.transactionId)
      ?.defineSample[0];

    if (!define) {
      return draft;
    }

    const results: HttpTestCaseResult[] = [];
    const utils = createHookUtils(
      this.#format,
      this.runRequestForHooks,
      // A `defineSample` hook runs before any request exists, so there is no
      // nested pipeline for it to re-enter.
      undefined,
      results,
      this.logger,
    );

    await (
      define.registration.callback as (
        draft: HttpRequestTemplate,
        utils: unknown,
      ) => unknown
    )(draft, utils);

    // A `defineSample` hook has no test case to attach results to, so anything
    // it records through `utils` is logged rather than silently dropped.
    for (const result of results) {
      this.logger.info(result.message);
    }

    return draft;
  }
}
