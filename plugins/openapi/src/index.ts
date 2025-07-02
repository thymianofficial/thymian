import type { ThymianNode, ThymianPlugin } from '@thymian/core';

import { loadOpenapi, type ParseOpenApiOptions } from './load-openapi.js';

declare module '@thymian/core' {
  interface ThymianHttpRequest {
    extensions: {
      openapiV3: {
        operationId?: string;
      };
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

export const openApiPlugin: ThymianPlugin<Partial<ParseOpenApiOptions>> = {
  name: '@thymian/openapi',
  version: '0.x',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      filePath: {
        type: 'string',
      },
      port: {
        type: 'integer',
      },
      host: {
        type: 'string',
      },
      protocol: {
        type: 'string',
        enum: ['http', 'https'],
      },
      allowExternalFiles: {
        type: 'boolean',
      },
      fetchExternalRefs: {
        type: 'boolean',
      },
    },
  },
  plugin: async (emitter, logger, opts) => {
    emitter.onHook('core.load-format', async () => {
      return {
        result: (await loadOpenapi(logger, opts)).export(),
      };
    });

    emitter.onHook('core.close', () => {
      return {
        result: {
          pluginName: '@thymian/openapi',
          message: JSON.stringify({}),
          status: 'success',
        },
      };
    });
  },
};

export default openApiPlugin;
