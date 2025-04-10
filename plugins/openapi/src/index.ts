import type { ThymianNode, ThymianPlugin } from '@thymian/core';
import { type ParseOpenApiOptions, loadOpenapi } from './load-openapi.js';

declare module '@thymian/core' {
  interface ThymianHttpRequest {
    extensions: {
      openapiV3: {
        operationId?: string;
      };
    };
  }

  interface ThymianHooks {
    'openapi.load': {
      args: [Partial<ParseOpenApiOptions>];
      returnType: ThymianFormat;
    };
  }

  interface SecurityScheme {
    extensions: {
      openapiV3: {
        schemeName: string;
      };
    };
  }

  interface ThymianFormat {
    getNodeByExtension(
      extensionName: 'openapiV3',
      values: { operationId: string }
    ): ThymianNode | undefined;
  }
}

export const openApiPlugin: ThymianPlugin = {
  name: '@thymian/openapi',
  version: '0.x',
  options: {},
  hooks: {
    'openapi.load': {
      output: {},
      input: {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          filePath: {
            type: 'string',
            default: 'openapi.yaml',
          },
          port: {
            type: 'integer',
            default: 8080,
          },
          host: {
            type: 'string',
            default: 'localhost',
          },
          protocol: {
            type: 'string',
            enum: ['http', 'https'],
            default: 'http',
          },
          allowExternalFiles: {
            type: 'boolean',
            default: true,
          },
          fetchExternalRefs: {
            type: 'string',
            default: false,
          },
        },
      },
    },
  },
  plugin: async (emitter, logger) => {
    emitter.onHook('openapi.load', async (opts) => {
      console.log(opts);
      return loadOpenapi(logger, opts);
    });
  },
};

export default openApiPlugin;
