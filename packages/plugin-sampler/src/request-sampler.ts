import type { ThymianEmitter, ThymianFormat } from '@thymian/core';

import { projectSamplesForThymianFormat } from './generation/project-samples-for-format.js';
import type { HttpRequestSample } from './http-request-sample.js';

/**
 * Serves `core.request.sample` from an in-memory projection of the loaded format.
 *
 * Samples are virtual: nothing here is read from disk, so there is no baseline a
 * sample could be stale against and no `thymian sampler init` precondition.
 */
export class RequestSampler {
  private samples: Map<string, HttpRequestSample> = new Map();

  /**
   * (Re)builds the projection from `format`. Called on every `core.format`, which
   * is what keeps the samples in lockstep with the loaded API description.
   */
  async init(format: ThymianFormat, emitter: ThymianEmitter): Promise<void> {
    this.samples = await projectSamplesForThymianFormat(format, emitter);
  }

  sampleForTransaction(transactionId: string): HttpRequestSample | undefined {
    return this.samples.get(transactionId);
  }
}
