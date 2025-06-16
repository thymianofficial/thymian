import {
  ThymianError,
  type ThymianPlugin,
  type ThymianSchema,
} from '@thymian/core';
import { ContentGenerator } from './content-generator.js';
import { JsonContentTypeStrategy } from './content-types-strategies/json.content-type-strategy.js';
import { HookContentTypeStrategy } from './content-types-strategies/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-types-strategies/image.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-types-strategies/xml.content-type-strategy.js';

declare module '@thymian/core' {
  interface ThymianHooks {
    'data-generator.generate': {
      arg: {
        contentType: string;
        schema: ThymianSchema;
      };
      returnType: unknown;
    };
  }
}

export const dataGeneratorPlugin: ThymianPlugin = {
  name: '@thymian/data-generator',
  version: '0.x',
  options: {},
  hooks: {
    'data-generator.generate': {
      input: {
        type: 'object',
        properties: {
          contentType: { type: 'string' },
          schema: { type: 'object' },
        },
      },
      output: {},
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

    emitter.onHook(
      'data-generator.generate',
      async ({ schema, contentType }) => {
        try {
          return await generator.generate(contentType, schema);
        } catch (e) {
          throw new ThymianError('Cannot generate data.', e);
        }
      }
    );
  },
};

export default dataGeneratorPlugin;
