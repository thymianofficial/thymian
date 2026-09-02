import {
  type HttpRequestTemplate,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import { HookRunner } from './hooks/hook-runner.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';
import { RequestSampler } from './request-sampler.js';

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
    // `path` is carried unresolved: in v1 it named the samples tree, which no
    // longer exists, and the sampler root it will name instead is introduced
    // together with the commands that write there. Reading it here would only
    // resolve a directory nothing touches.
    void options;

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

    emitter.onAction('core.format', async (serialized, ctx) => {
      const format = ThymianFormat.import(serialized);

      await requestSampler.load(format, emitter);
      hookRunner.load(format);

      logger.debug('Projected request samples for the loaded format.');

      ctx.reply();
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
