import {
  type PartialExceptFor,
  type ThymianNode,
  type ThymianPlugin,
} from '@thymian/core';

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

export type OpenApiPluginOptions = PartialExceptFor<
  ParseOpenApiOptions,
  'filePath'
>;

export const defaultOpenApiPluginOptions: Omit<
  ParseOpenApiOptions,
  'filePath'
> = {
  port: 8080,
  host: 'localhost',
  protocol: 'http' as 'http' | 'https',
  allowExternalFiles: true,
  fetchExternalRefs: false,
};

export const openApiPlugin: ThymianPlugin<OpenApiPluginOptions> = {
  name: '@thymian/openapi',
  version: '0.x',
  options: {
    type: 'object',
    additionalProperties: false,
    required: ['filePath'],
    properties: {
      filePath: {
        type: 'string',
        nullable: false,
      },
      port: {
        type: 'integer',
        nullable: true,
      },
      host: {
        type: 'string',
        nullable: true,
      },
      protocol: {
        type: 'string',
        nullable: true,
        enum: ['http', 'https'],
      },
      allowExternalFiles: {
        nullable: true,
        type: 'boolean',
      },
      fetchExternalRefs: {
        nullable: true,
        type: 'boolean',
      },
    },
  },
  plugin: async (emitter, logger, opts) => {
    console.log({ opts });

    emitter.onAction('core.load-format', async (_, ctx) => {
      try {
        console.log('load format');

        const format = await loadOpenapi(logger, {
          ...defaultOpenApiPluginOptions,
          ...opts,
        });

        console.log({ format: JSON.stringify(format.export()) });

        ctx.reply(format.export());
      } catch (e) {
        ctx.error(e);
      }
    });
  },
};

export default openApiPlugin;
