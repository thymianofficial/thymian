import {
  type HttpRequestTemplate,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import { unresolvedHooksError } from './hooks/hook-diagnostics.js';
import { HookRunner } from './hooks/hook-runner.js';
import { loadUserHooks } from './hooks/load-user-hooks.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';
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
    const hookRunner = new HookRunner(async (request) => {
      return await emitter.emitAction(
        'core.request.dispatch',
        {
          request,
        },
        {
          strategy: 'first',
        },
      );
    }, logger);

    let catalog = TransactionCatalog.fromThymianFormat(new ThymianFormat());

    emitter.onAction('core.format', async (serialized, ctx) => {
      const format = ThymianFormat.import(serialized);

      // Before the projection, so an ambiguous description fails at catalog
      // build rather than after generating samples nobody can address.
      catalog = TransactionCatalog.fromThymianFormat(format);

      await requestSampler.load(format, emitter);

      const hooks = await loadUserHooks(paths.hooksDir, catalog);

      // A hook that does not resolve fails the run fast, before a single
      // request is sent: a dangling Selector is the signal that the description
      // moved, and running the rest of the suite as if nothing happened is what
      // the compiler-as-drift-oracle design exists to prevent.
      if (hooks.diagnostics.length > 0) {
        throw unresolvedHooksError(hooks.diagnostics);
      }

      hookRunner.load(format, hooks);

      logger.debug(
        `Catalogued ${catalog.size} transactions, projected their request samples and loaded ${hooks.files.length} hook file(s) from ${paths.hooksDir}.`,
      );

      ctx.reply();
    });

    emitter.onAction('sampler.show', async ({ selector }, ctx) => {
      const transaction = catalog.resolve(selector);
      const sample = await requestSampler.sampleForTransaction(
        transaction,
        emitter,
      );

      ctx.reply({
        selector,
        request: requestSampleToRequestTemplate(sample),
      });
    });

    emitter.onAction('core.request.sample', async ({ transaction }, ctx) => {
      const sample = await requestSampler.sampleForTransaction(
        transaction,
        emitter,
      );

      ctx.reply(requestSampleToRequestTemplate(sample));
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
  },
};

export default samplePlugin;
