import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type HttpRequestTemplate,
  ThymianEmitter,
  type ThymianFormat,
} from '@thymian/core';
import { createSilentMockLogger } from '@thymian/core-testing';

import { samplePlugin, type SamplerPluginOptions } from '../src/index.js';

export type SamplerHarness = {
  /** The emitter the plugin is registered on. */
  emitter: ThymianEmitter;
  /** The temporary working directory the plugin was started in. */
  cwd: string;
  /** Publish a format to the plugin, exactly as `thymian test` does. */
  loadFormat(format: ThymianFormat): Promise<void>;
  /** Ask for the freshly projected request template of one transaction. */
  sample(
    transactionId: string,
    format: ThymianFormat,
  ): Promise<HttpRequestTemplate>;
  /**
   * Every transaction's template, in the format's own transaction order.
   *
   * An ordered list rather than a map keyed by transaction id: the ids are
   * content hashes, so a keyed image would compare equal regardless of the
   * order the sampler produced things in, and order is part of what the
   * determinism assertions are about.
   */
  sampleAll(format: ThymianFormat): Promise<HttpRequestTemplate[]>;
  dispose(): Promise<void>;
};

/**
 * Start `@thymian/plugin-sampler` on a real {@link ThymianEmitter} in a fresh,
 * empty working directory.
 *
 * This is the **plugin event seam**: tests drive the plugin through the very
 * actions `thymian test` uses (`core.format`, `core.request.sample`,
 * `http-testing.*`, `core.close`) and observe only what a caller can observe.
 * The empty `cwd` is load-bearing — it is what "nothing on disk" means, and
 * {@link expectNothingWritten} asserts it stayed that way.
 */
export async function startSampler(
  options: Partial<SamplerPluginOptions> = {},
): Promise<SamplerHarness> {
  const cwd = await mkdtemp(join(tmpdir(), 'thymian-sampler-'));
  // Generation walks every transaction of a format, which can outlast the
  // emitter's 1s default action timeout on the larger fixtures.
  const emitter = new ThymianEmitter(
    createSilentMockLogger(),
    ThymianEmitter.emptyEmitterState(),
    { timeout: 30_000 },
  );

  await samplePlugin.plugin(emitter, createSilentMockLogger(), {
    ...options,
    cwd,
  });

  const harness: SamplerHarness = {
    emitter,
    cwd,
    async loadFormat(format) {
      await emitter.emitAction('core.format', format.export(), {
        strategy: 'first',
      });
    },
    async sample(transactionId, format) {
      const transaction = format.getThymianHttpTransactionById(transactionId);

      if (!transaction) {
        throw new Error(`No transaction ${transactionId} in this format.`);
      }

      return await emitter.emitAction(
        'core.request.sample',
        { transaction },
        { strategy: 'first' },
      );
    },
    async sampleAll(format) {
      const samples: HttpRequestTemplate[] = [];

      for (const transaction of format.getThymianHttpTransactions()) {
        samples.push(await harness.sample(transaction.transactionId, format));
      }

      return samples;
    },
    async dispose() {
      await rm(cwd, { recursive: true, force: true });
    },
  };

  return harness;
}
