import type { ThymianPlugin } from '@thymian/core';
import { JsonDataServer } from '@thymian/json-data-generator-osx-arm64';

declare module '@thymian/core' {
  interface ThymianHooks {
    'json-data-generator.generate': {
      args: [Record<PropertyKey, unknown>];
      returnType: unknown;
    };
  }
}

export const jsonDataGeneratorPlugin: ThymianPlugin = {
  name: '@thymian/json-data-generator',
  version: '0.x',
  options: {},
  hooks: {
    'json-data-generator.generate': {
      // we don't know the output and an empty schema is valid for any non-empty data
      output: {},
      input: {
        type: 'object',
      },
    },
  },
  plugin: async (emitter) => {
    let generator: JsonDataServer;
    const controller = new AbortController();

    emitter.onHook('thymian.ready', async () => {
      generator = new JsonDataServer(controller.signal);

      await generator.init();
    });

    emitter.onHook('json-data-generator.generate', (schema) => {
      return generator.request(schema);
    });

    emitter.onHook('thymian.close', () => {
      controller.abort();
    });
  },
};
