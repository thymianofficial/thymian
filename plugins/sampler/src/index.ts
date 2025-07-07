import {
  ThymianBaseError,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';

import { ContentGenerator } from './content-generator.js';
import { HookContentTypeStrategy } from './content-types-strategies/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-types-strategies/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from './content-types-strategies/json.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-types-strategies/xml.content-type-strategy.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'sampler.generate': {
      event: {
        contentType: string;
        schema: ThymianSchema;
      };
      response: { content: unknown; encoding?: string };
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

export const dataGeneratorPlugin: ThymianPlugin = {
  name: '@thymian/sampler',
  version: '0.x',
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

    emitter.onAction(
      'sampler.generate',
      async ({ schema, contentType }, ctx) => {
        try {
          const result = await generator.generate(contentType, schema);

          ctx.reply(result);
        } catch (e) {
          ctx.error(
            new ThymianBaseError('Cannot generate data.', { cause: e })
          );
        }
      }
    );
  },
};

export default dataGeneratorPlugin;
