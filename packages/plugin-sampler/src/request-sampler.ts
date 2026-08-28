import {
  ThymianBaseError,
  type ThymianEmitter,
  type ThymianFormat,
} from '@thymian/core';

import { projectSamplesForThymianFormat } from './generation/project-samples-for-format.js';
import type { HttpRequestSample } from './http-request-sample.js';
import { LoadGeneration } from './load-generation.js';

/**
 * Serves `core.request.sample` from an in-memory projection of the loaded format.
 *
 * Samples are virtual: nothing here is read from disk, so there is no baseline a
 * sample could be stale against and no `thymian sampler init` precondition.
 */
export class RequestSampler {
  private samples: Map<string, HttpRequestSample> = new Map();

  /**
   * Which load is current. Shared with whoever else the caller hands the same
   * {@link LoadGeneration} to — `index.ts` hands `HookRunner` the identical
   * instance, because both are dependents of the same `core.format` event and
   * must be superseded together. See {@link LoadGeneration}'s docblock for why
   * a counter local to this class (what stood here through round 5) answers
   * the wrong question once more than one async step runs ahead of `init`.
   *
   * Defaults to a private instance so this class stays usable on its own in a
   * test that does not care about cross-component ordering.
   */
  constructor(
    private readonly generation: LoadGeneration = new LoadGeneration(),
  ) {}

  /**
   * Drops the previous format's projection.
   *
   * `index.ts` calls this *before* two steps that both throw by design —
   * `TransactionCatalog.fromThymianFormat` on a cross-source selector
   * collision, and the samples-tree read on a refused path traversal. Either
   * one used to leave this projection holding the format *before* the one
   * that just failed to load, so `core.request.sample` kept answering from an
   * API description no longer loaded, and the "unreachable by construction"
   * invariant its caller relies on stopped holding.
   */
  invalidate(): void {
    this.samples = new Map();
  }

  /**
   * (Re)builds the projection from `format`. Called on every `core.format`, which
   * is what keeps the samples in lockstep with the loaded API description.
   *
   * `token` is the caller's {@link LoadGeneration.start} result for the load
   * this projection belongs to. Defaults to starting one of its own, for a
   * caller that only needs "does a later `init` on this instance supersede an
   * earlier one" and not "is this instance's load still current against
   * something else's clock" — `index.ts` always passes its own token, taken
   * once before *any* of this reload's async work, including the samples-tree
   * read that runs ahead of this call.
   */
  async init(
    format: ThymianFormat,
    emitter: ThymianEmitter,
    token: number = this.generation.start(),
  ): Promise<void> {
    const projection = await projectSamplesForThymianFormat(format, emitter);

    if (!this.generation.isCurrent(token)) {
      throw new ThymianBaseError(
        'The request sampler was re-initialized while this format was loading, so this load was discarded.',
        { name: 'RequestSamplerSuperseded' },
      );
    }

    this.samples = projection;
  }

  sampleForTransaction(transactionId: string): HttpRequestSample | undefined {
    return this.samples.get(transactionId);
  }
}
