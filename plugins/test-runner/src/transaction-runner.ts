import { type Logger, ThymianEmitter } from '@thymian/core';
import type { HttpTransaction } from './types.js';
import { deepMergeHttpTransaction } from './deep-merge.js';
import { performRequest } from './request.js';

export class TransactionRunner {
  constructor(
    private readonly logger: Logger,
    private readonly emitter: ThymianEmitter
  ) {}

  async run(transaction: HttpTransaction): Promise<HttpTransaction> {
    const transactionId = transaction.id;

    this.logger.debug(`Start running http transaction ${transactionId}`);

    const before = await this.emitter.runHook<HttpTransaction>(
      `before.${transactionId}`
    );

    transaction = deepMergeHttpTransaction(transaction, ...before);
    // is case some hook tried to override the id of the transaction
    transaction.id = transactionId;

    transaction.actualResponse = await performRequest(transaction.request);

    const after = await this.emitter.runHook<HttpTransaction>(
      `after.${transactionId}`
    );

    return deepMergeHttpTransaction(transaction, ...after);
  }
}
