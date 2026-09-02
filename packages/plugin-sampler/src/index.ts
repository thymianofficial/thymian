import {
  type HttpRequestTemplate,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import {
  hookConflictError,
  unresolvedHooksError,
} from './hooks/hook-diagnostics.js';
import { HookRunner } from './hooks/hook-runner.js';
import { loadUserHooks } from './hooks/load-user-hooks.js';
import { RequestSampler } from './request-sampler.js';
import { resolveSamplerPaths } from './sampler-paths.js';
import { TransactionCatalog } from './selectors/transaction-catalog.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'core.request.sample': {
      event: {
        transaction: ThymianHttpTransaction;
        options?: Record<string, unknown>;
      };
      response: HttpRequestTemplate;
    };

    'sampler.unknown-type': {
      event: {
        contentType: string;
        schema: ThymianSchema;
      };
      response: { $content: unknown; $encoding?: string };
    };

    'sampler.show': {
      event: {
        selector: string;
      };
      response: {
        selector: string;
        request: HttpRequestTemplate;
      };
    };
  }
}

export type SamplerPluginOptions = {
  path: string;
};

export const samplePlugin: ThymianPlugin<Partial<SamplerPluginOptions>> = {
  name: '@thymian/plugin-sampler',
  version: '0.x',
  actions: {
    // What this plugin answers, what it asks for, and what it hands off. Kept
    // in step with the `onAction` calls below; `provides` stays empty because
    // the payload schemas would be hand-written duplicates of the types.
    listensOn: [
      'core.format',
      'core.close',
      'core.request.sample',
      'http-testing.beforeRequest',
      'http-testing.afterResponse',
      'http-testing.authorize',
      'sampler.show',
    ],
    emits: ['sampler.unknown-type'],
  },
  options: {
    // ### for reference documentation ###
    title: 'Plugin Options',
    description: 'Configuration options for the Sampler plugin',
    // ###################################
    type: 'object',
    properties: {
      path: {
        type: 'string',
        nullable: true,
      },
    },
  },
  plugin: async (emitter, logger, options) => {
    const paths = resolveSamplerPaths(options.cwd, options.path);

    const requestSampler = new RequestSampler();
    const hookRunner = new HookRunner(logger, {
      sampleRequest: async (transaction) =>
        await requestSampler.sampleForTransaction(transaction, emitter),
      dispatch: async (request) =>
        await emitter.emitAction(
          'core.request.dispatch',
          { request },
          { strategy: 'first' },
        ),
    });

    let catalog = TransactionCatalog.fromThymianFormat(new ThymianFormat());

    emitter.onAction('core.format', async (serialized, ctx) => {
      const format = ThymianFormat.import(serialized);

      // Before the projection, so an ambiguous description fails at catalog
      // build rather than after generating samples nobody can address.
      catalog = TransactionCatalog.fromThymianFormat(format);

      const hooks = await loadUserHooks(paths.hooksDir, catalog);

      // A hook that does not resolve fails the run fast, before a single
      // request is sent: a dangling Selector is the signal that the description
      // moved, and running the rest of the suite as if nothing happened is what
      // the compiler-as-drift-oracle design exists to prevent.
      if (hooks.diagnostics.length > 0) {
        throw unresolvedHooksError(hooks.diagnostics);
      }

      if (hooks.conflicts.length > 0) {
        throw hookConflictError(hooks.conflicts);
      }

      for (const warning of hooks.warnings) {
        logger.warn(warning);
      }

      hookRunner.load(format, catalog, hooks);
      // After the hooks, because the sampler asks the runner to shape each
      // draft with its `defineSample` hook.
      await requestSampler.load(format, emitter, hookRunner.shapeSample);

      logger.debug(
        `Catalogued ${catalog.size} transactions, projected their request samples and loaded ${hooks.files.length} hook file(s) from ${paths.hooksDir}.`,
      );

      ctx.reply();
    });

    emitter.onAction('sampler.show', async ({ selector }, ctx) => {
      const transaction = catalog.resolve(selector);

      ctx.reply({
        selector,
        request: await requestSampler.sampleForTransaction(
          transaction,
          emitter,
        ),
      });
    });

    emitter.onAction('core.request.sample', async ({ transaction }, ctx) => {
      ctx.reply(
        await requestSampler.sampleForTransaction(transaction, emitter),
      );
    });

    emitter.onAction('http-testing.beforeRequest', async (hook, ctx) => {
      ctx.reply(await hookRunner.beforeEachRequest(hook));
    });

    emitter.onAction('http-testing.afterResponse', async (hook, ctx) => {
      ctx.reply(await hookRunner.afterEachResponse(hook));
    });

    emitter.onAction('http-testing.authorize', async (hook, ctx) => {
      ctx.reply(await hookRunner.authorize(hook));
    });

    emitter.onAction('core.close', async (_event, ctx) => {
      await hookRunner.close();

      ctx.reply();
    });
  },
};

export default samplePlugin;
