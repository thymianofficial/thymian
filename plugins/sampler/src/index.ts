import {
  ThymianError,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';

import { ContentGenerator } from './content-generator.js';
import { HookContentTypeStrategy } from './content-types-strategies/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-types-strategies/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from './content-types-strategies/json.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-types-strategies/xml.content-type-strategy.js';

declare module '@thymian/core' {
  interface ThymianHooks {
    'sampler.generate': {
      arg: {
        contentType: string;
        schema: ThymianSchema;
      };
      returnType: { content: unknown; encoding?: string };
    };

    'sampler.unknown-type': {
      arg: {
        contentType: string;
        schema: ThymianSchema;
      };
      returnType: { content: unknown; encoding?: string };
    };
  }
}

export const dataGeneratorPlugin: ThymianPlugin = {
  name: '@thymian/sampler',
  version: '0.x',
  hooks: {
    'sampler.generate': {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      arg: {
        type: 'object',
        required: ['contentType', 'schema'],
        properties: {
          contentType: { type: 'string' },
          schema: {},
        },
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      returns: {
        type: 'object',
        required: ['contentType', 'schema'],
        properties: {
          contentType: { type: 'string' },
          schema: {},
        },
      },
    },
  },
  events: {},
  plugin: async (emitter) => {
    const generator = new ContentGenerator(
      [
        new JsonContentTypeStrategy(),
        new XmlContentTypeStrategy(),
        new ImageContentTypeStrategy(),
      ],
      new HookContentTypeStrategy(emitter)
    );

    emitter.onHook('sampler.generate', async ({ schema, contentType }) => {
      try {
        return await generator.generate(contentType, schema);
      } catch (e) {
        throw new ThymianError('Cannot generate data.', e);
      }
    });
  },
};

export default dataGeneratorPlugin;
