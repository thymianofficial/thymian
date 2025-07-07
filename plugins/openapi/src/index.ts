import {
  ThymianBaseError,
  type ThymianNode,
  type ThymianPlugin,
} from '@thymian/core';

import { loadOpenapi, type ParseOpenApiOptions } from './load-openapi.js';
import { OpenApiError } from './error.js';

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
    emitter.onAction('core.load-format', async (_, ctx) => {
      try {
        const format = await loadOpenapi(logger, opts);

        ctx.reply(format.export());
      } catch (e) {
        if (e instanceof ThymianBaseError) {
          ctx.error(e);
        } else {
          ctx.error(
            new OpenApiError(
              'Unexpected error while loading OpenAPI document.',
              {
                cause: e,
              }
            )
          );
        }
      }
    });

    emitter.onAction('core.close', (_, ctx) => {
      ctx.reply({
        pluginName: '@thymian/openapi',
        message: JSON.stringify({}),
        status: 'success',
      });
    });
  },
};

export default openApiPlugin;
