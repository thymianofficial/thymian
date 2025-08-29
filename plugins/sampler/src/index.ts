import { join } from 'node:path';

import {
  type HttpRequestTemplate,
  type SerializedThymianFormat,
  ThymianFormat,
  type ThymianHttpTransaction,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';

import { ContentGenerator } from './content-generator/content-generator.js';
import { HookContentTypeStrategy } from './content-generator/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-generator/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from './content-generator/json.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-generator/xml.content-type-strategy.js';
import { FileOutputWriter } from './output-writer/file.output-writer.js';
import { generate } from './request-generators/generate.js';
import { Sampler } from './sampler.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'sampler.generate': {
      event: {
        format: SerializedThymianFormat;
      };
      response: void;
    };

    'sampler.sample-request': {
      event: {
        transaction: ThymianHttpTransaction;
      };
      response: HttpRequestTemplate;
    };

    'sampler.unknown-type': {
      event: {
        contentType: string;
        schema: ThymianSchema;
      };
      response: { content: unknown; encoding?: string };
    };
  }
}

export type SamplerPluginOptions = {
  cwd: string;
  path: string;
  force: boolean;
};

export const samplePlugin: ThymianPlugin<Partial<SamplerPluginOptions>> = {
  name: '@thymian/sampler',
  version: '0.x',
  options: {
    type: 'object',
    properties: {
      cwd: {
        type: 'string',
        nullable: true,
      },
      path: {
        type: 'string',
        nullable: true,
      },
      force: {
        type: 'boolean',
        nullable: true,
      },
    },
  },
  actions: {
    provides: {
      'sampler.generate': {
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
    const opts: SamplerPluginOptions = {
      cwd: process.cwd(),
      path: '.thymian/samples',
      force: false,
      ...options,
    };
    const basePath = join(opts.cwd, opts.path);

    emitter.onAction('sampler.generate', async ({ format }, ctx) => {
      const contentGenerator = new ContentGenerator(
        [
          new JsonContentTypeStrategy(),
          new XmlContentTypeStrategy(),
          new ImageContentTypeStrategy(),
        ],
        new HookContentTypeStrategy(emitter)
      );

      const outputWriter = new FileOutputWriter(basePath, opts.force);
      const parsedFormat = ThymianFormat.import(format);

      for (const transaction of parsedFormat.getThymianHttpTransactions()) {
        await generate(
          parsedFormat,
          transaction,
          contentGenerator,
          outputWriter
        );
      }

      ctx.reply();
    });

    const sampler = new Sampler(basePath);

    emitter.onAction('core.ready', async (_, ctx) => {
      await sampler.checkIfIsInitialized();

      ctx.reply();
    });

    emitter.onAction('sampler.sample-request', async ({ transaction }, ctx) => {
      const sample = await sampler.sample(transaction);

      ctx.reply(sample);
    });
  },
};

export default samplePlugin;
