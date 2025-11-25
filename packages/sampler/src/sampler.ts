import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type HttpRequestTemplate,
  ThymianBaseError,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { LRUCache } from 'lru-cache';

import type { HttpRequestSample } from './http-request-sample.js';
import { createPathForTransaction } from './output-writer/create-path-for-transaction.js';

export class Sampler {
  constructor(
    private readonly basePath: string,
    private readonly cache: LRUCache<
      string,
      HttpRequestTemplate
    > = new LRUCache({
      max: 500,
    }),
  ) {}

  async checkIfIsInitialized(): Promise<void> {
    try {
      await access(this.basePath);
    } catch (err) {
      throw new ThymianBaseError(`@thymian/sampler is not initialized.`, {
        name: 'SamplerError',
        suggestions: ['Did you run thymian sampler:init?'],
        cause: err,
      });
    }
  }

  async sample(
    transaction: ThymianHttpTransaction,
  ): Promise<HttpRequestTemplate> {
    const transactionId = transaction.transactionId;

    const cached = this.cache.get(transactionId);

    if (cached) {
      return cached;
    }

    const path = join(this.basePath, createPathForTransaction(transaction));

    const filePath = join(path, 'request.json');

    try {
      await access(filePath);
    } catch (err) {
      throw new ThymianBaseError(
        `Cannot sample request for transaction ${transaction.transaction.label}.`,
        {
          name: 'SamplerError',
          suggestions: ['Did you run thymian sampler:init?'],
          cause: err,
        },
      );
    }

    const requestSample = JSON.parse(
      await readFile(filePath, 'utf-8'),
    ) as HttpRequestSample;

    if (requestSample.meta.bodyPath) {
      const bodyFilePath = join(path, requestSample.meta.bodyPath);
      requestSample.request.body = await readFile(
        bodyFilePath,
        (requestSample.request.bodyEncoding as BufferEncoding) ?? 'utf-8',
      );
    }

    this.cache.set(transactionId, requestSample.request);

    return requestSample.request;
  }
}
