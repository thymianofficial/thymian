import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  type HttpTestHooks,
  ThymianEmitter,
  type ThymianFormat,
} from '@thymian/core';
import { createSilentMockLogger } from '@thymian/core-testing';

import { samplePlugin, type SamplerPluginOptions } from '../src/index.js';
import { resolveSamplerPaths } from '../src/sampler-paths.js';
import type { ValidationReport } from '../src/validation/validate-sampler.js';

/** One request the harness answered, and with what. */
export type DispatchedRequest = {
  request: HttpRequest;
  response: HttpResponse;
};

export type SamplerHarness = {
  /** The emitter the plugin is registered on. */
  emitter: ThymianEmitter;
  /** The temporary working directory the plugin was started in. */
  cwd: string;
  /** The sampler hooks directory inside {@link cwd}. */
  hooksDir: string;
  /** Every request the plugin put on the wire, in order. */
  dispatched: DispatchedRequest[];
  /**
   * What to answer the next request with. Consumed in order; when it runs out,
   * an empty 200 is returned.
   */
  responses: Partial<HttpResponse>[];
  /**
   * Write a hook file, exactly as a user would: a real file under the hooks
   * directory, importing `@thymian/hooks`, with nothing else set up.
   */
  writeHook(relativePath: string, source: string): Promise<void>;
  /** Publish a format to the plugin, exactly as `thymian test` does. */
  loadFormat(format: ThymianFormat): Promise<void>;
  /**
   * Publish a format and then ask for the first request, which is what makes a
   * command a *run*.
   *
   * The sampler refuses to start a run while a hook does not resolve, and it
   * refuses *here* rather than when the format arrives — `sampler validate` has
   * to survive publishing in order to report every unresolved hook at once.
   */
  beginRun(format: ThymianFormat): Promise<void>;
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
  /** Run the `beforeRequest` seam for one transaction, as the tester does. */
  beforeRequest(
    transactionId: string,
    format: ThymianFormat,
    request?: Partial<HttpRequestTemplate>,
  ): Promise<HttpTestHooks['beforeRequest']['return']>;
  /** Run the `afterResponse` seam for one transaction, as the tester does. */
  afterResponse(
    transactionId: string,
    format: ThymianFormat,
    response: HttpResponse,
  ): Promise<HttpTestHooks['afterResponse']['return']>;
  /** What `sampler show <selector>` prints, before it is formatted. */
  show(selector: string): Promise<{
    selector: string;
    request: HttpRequestTemplate;
  }>;
  /** Run the `authorize` seam for one transaction, as the tester does. */
  authorize(
    transactionId: string,
    format: ThymianFormat,
  ): Promise<HttpTestHooks['authorize']['return']>;
  /** What `sampler init` does, and reports. */
  init(): Promise<{
    root: string;
    generated: string[];
    tsconfig: 'written' | 'kept';
    rootExcludeNote: string[];
  }>;
  /** What `sampler sync` does, and reports. */
  sync(check?: boolean): Promise<{ changed: string[]; wrote: boolean }>;
  /** What `sampler validate` reports. */
  validate(): Promise<ValidationReport>;
  /** Close the run, as core does when a command finishes. */
  close(): Promise<void>;
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

  const dispatched: DispatchedRequest[] = [];
  const responses: Partial<HttpResponse>[] = [];

  // The dispatcher the sampler talks to, standing in for
  // `@thymian/plugin-request-dispatcher`. Registered here so a nested
  // `utils.request` has somewhere to send to and the test can see what it sent.
  emitter.onAction('core.request.dispatch', ({ request }, ctx) => {
    const response: HttpResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: '{}',
      trailers: {},
      duration: 0,
      ...responses.shift(),
    };

    dispatched.push({ request, response });

    ctx.reply(response);
  });

  await samplePlugin.plugin(emitter, createSilentMockLogger(), {
    ...options,
    cwd,
  });

  const paths = resolveSamplerPaths(cwd, options.path);

  const harness: SamplerHarness = {
    emitter,
    cwd,
    hooksDir: paths.hooksDir,
    dispatched,
    responses,
    async writeHook(relativePath, source) {
      const target = join(paths.hooksDir, relativePath);

      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, source, 'utf-8');
    },
    async loadFormat(format) {
      await emitter.emitAction('core.format', format.export(), {
        strategy: 'first',
      });
    },
    async beginRun(format) {
      await harness.loadFormat(format);

      const [transaction] = format.getThymianHttpTransactions();

      if (!transaction) {
        throw new Error('this format has no transaction to run');
      }

      await harness.sample(transaction.transactionId, format);
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
    async beforeRequest(transactionId, format, request) {
      const transaction = format.getThymianHttpTransactionById(transactionId);

      if (!transaction) {
        throw new Error(`No transaction ${transactionId} in this format.`);
      }

      const value = {
        ...(await harness.sample(transactionId, format)),
        ...request,
      };

      return await emitter.emitAction(
        'http-testing.beforeRequest',
        { value, ctx: transaction },
        { strategy: 'first' },
      );
    },
    async afterResponse(transactionId, format, response) {
      const transaction = format.getThymianHttpTransactionById(transactionId);

      if (!transaction) {
        throw new Error(`No transaction ${transactionId} in this format.`);
      }

      const requestTemplate = await harness.sample(transactionId, format);

      return await emitter.emitAction(
        'http-testing.afterResponse',
        {
          value: response,
          ctx: {
            requestTemplate,
            request: {
              ...requestTemplate,
              url: `${requestTemplate.origin}${requestTemplate.path}`,
            } as never,
            thymianTransaction: transaction,
          },
        },
        { strategy: 'first' },
      );
    },
    async authorize(transactionId, format) {
      const transaction = format.getThymianHttpTransactionById(transactionId);

      if (!transaction) {
        throw new Error(`No transaction ${transactionId} in this format.`);
      }

      return await emitter.emitAction(
        'http-testing.authorize',
        {
          value: await harness.sample(transactionId, format),
          ctx: transaction,
        },
        { strategy: 'first' },
      );
    },
    async show(selector) {
      return await emitter.emitAction(
        'sampler.show',
        { selector },
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
    async init() {
      return await emitter.emitAction(
        'sampler.init',
        {},
        { strategy: 'first' },
      );
    },
    async sync(check = false) {
      return await emitter.emitAction(
        'sampler.sync',
        { check },
        { strategy: 'first' },
      );
    },
    async validate() {
      return await emitter.emitAction(
        'sampler.validate',
        {},
        { strategy: 'first' },
      );
    },
    async close() {
      // `strict: false`, as core emits it: `core.close` is a broadcast that
      // does not require anyone to answer.
      await emitter.emitAction('core.close', undefined, {
        strategy: 'collect',
        strict: false,
      });
    },
    async dispose() {
      await rm(cwd, { recursive: true, force: true });
    },
  };

  return harness;
}
