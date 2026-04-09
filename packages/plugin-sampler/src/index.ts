import { writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
  type HttpRequestTemplate,
  type SerializedThymianFormat,
  ThymianBaseError,
  ThymianFormat,
  type ThymianHttpTransaction,
  thymianHttpTransactionToString,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import type {} from '@thymian/plugin-request-dispatcher';

import { generateSamplesForThymianFormat } from './generation/generate-samples-for-thymian-format.js';
import {
  generatedTypesToString,
  generateTypesForThymianFormat,
} from './hooks/generate-request-types.js';
import { HookRunner } from './hooks/hook-runner.js';
import { tsConfig } from './hooks/ts-config.js';
import { requestSampleToRequestTemplate } from './request-sample-to-request-template.js';
import { RequestSampler } from './request-sampler.js';
import { getPathTransactionId } from './samples-structure/get-path-transaction-id.js';
import { readSamplesFromDir } from './samples-structure/read-samples-from-dir.js';
import type { SamplesStructure } from './samples-structure/samples-tree-structure.js';
import { writeSamplesToDir } from './samples-structure/write-samples-to-dir.js';
import { entryExists } from './utils.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'sampler.init': {
      event: {
        format: SerializedThymianFormat;
        overwrite?: boolean;
      };
      response: void;
    };

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

    'sampler.path-from-transaction': {
      event: {
        transactionId: string;
      };
      response: string | undefined;
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
  actions: {
    provides: {
      'sampler.init': {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        event: {
          type: 'object',
          required: ['contentType', 'schema'],
          properties: {
            contentType: { type: 'string' },
            schema: {},
          },
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        response: {
          type: 'object',
          required: ['contentType', 'schema'],
          properties: {
            contentType: { type: 'string' },
            schema: {},
          },
        },
      },
    },
  },
  plugin: async (emitter, logger, options) => {
    let basePath = join(options.cwd, '.thymian', 'samples');

    if (options.path) {
      basePath = isAbsolute(options.path)
        ? options.path
        : join(options.cwd, options.path);
    }

    let format: ThymianFormat | undefined;
    let samples: SamplesStructure | undefined;

    const requestSampler = new RequestSampler(basePath);
    const hookRunner = new HookRunner(
      basePath,
      async (request) => {
        return await emitter.emitAction(
          'core.request.dispatch',
          {
            request,
          },
          {
            strategy: 'first',
          },
        );
      },
      logger,
    );

    async function initializeSamplerAndHookRunner(format: ThymianFormat) {
      samples = (await entryExists(basePath))
        ? await readSamplesFromDir(basePath)
        : undefined;

      await requestSampler.init(samples);
      await hookRunner.init(format, samples);
    }

    emitter.onAction('core.format', async (f, ctx) => {
      format = ThymianFormat.import(f);

      await initializeSamplerAndHookRunner(format);

      ctx.reply();
    });

    emitter.onAction(
      'sampler.path-from-transaction',
      ({ transactionId }, ctx) => {
        if (!samples) {
          throw new ThymianBaseError('No samples are loaded.', {
            name: 'SamplesNotLoadedError',
            ref: 'https://thymian.dev/references/errors/samples-not-loaded-error/',
          });
        }

        ctx.reply(getPathTransactionId(transactionId, basePath, samples));
      },
    );

    emitter.onAction('sampler.init', async ({ format, overwrite }, ctx) => {
      const parsedFormat = ThymianFormat.import(format);

      const samples = await generateSamplesForThymianFormat(
        parsedFormat,
        emitter,
      );

      const generatedTypes = await generateTypesForThymianFormat(parsedFormat);

      await writeSamplesToDir(samples, generatedTypes.keyToTransactionId, {
        path: basePath,
        mode: typeof overwrite === 'boolean' ? 'overwrite' : 'failIfExist',
      });

      await writeFile(
        join(basePath, 'types.d.ts'),
        generatedTypesToString(generatedTypes.types),
      );

      await writeFile(
        join(basePath, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2),
      );

      ctx.reply();
    });

    emitter.onAction('core.request.sample', async ({ transaction }, ctx) => {
      if (!format) {
        throw new ThymianBaseError('Format is not loaded.', {
          name: 'FormatNotLoadedError',
          ref: 'https://thymian.dev/references/errors/format-not-loaded-error/',
        });
      }

      const sample = requestSampler.sampleForTransaction(
        transaction.transactionId,
      );
      if (!sample) {
        const currentFormatVersion = format.toHash();
        if (currentFormatVersion !== requestSampler.version()) {
          throw new ThymianBaseError(
            `Cannot sample for transaction "${thymianHttpTransactionToString(
              transaction.thymianReq,
              transaction.thymianRes,
            )}", because it based on version "${currentFormatVersion}" but the loaded samples are based on version "${requestSampler.version()}".`,
            {
              name: 'VersionMismatchError',
              suggestions: [
                `The loaded samples were generated at ${requestSampler.timestamp()}. Did you forget to regenerate the samples?`,
                '$ thymian sampler init',
              ],
              ref: 'https://thymian.dev/guides/samples/update-samples',
            },
          );
        }

        throw new ThymianBaseError(
          `Cannot sample for transaction ${thymianHttpTransactionToString(
            transaction.thymianReq,
            transaction.thymianRes,
          )} with transaction ID ${transaction.transactionId}`,
          {
            name: 'TransactionSampleNotFoundError',
            ref: 'https://thymian.dev/references/errors/transaction-sample-not-found-error/',
          },
        );
      }

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
