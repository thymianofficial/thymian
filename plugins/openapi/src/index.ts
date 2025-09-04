import {
  type PartialExceptFor,
  type ThymianNode,
  type ThymianPlugin,
} from '@thymian/core';

import { loadOpenapi, type ParseOpenApiOptions } from './load-openapi.js';

declare module '@thymian/core' {
  interface ThymianHttpRequest {
    extensions: {
      openapi: {
        operationId?: string;
        location?: string;
      };
    };
  }

  interface HttpTransaction {
    extensions: {
      openapi: {
        location?: string;
      };
    };
  }

  interface SecurityScheme {
    extensions: {
      openapi: {
        schemeName: string;
      };
    };
  }

  interface ThymianFormat {
    getNodeByExtension(
      extensionName: 'openapi',
      values: { operationId: string }
    ): ThymianNode | undefined;
  }

  interface ThymianEvents {
    'openapi.document': Record<PropertyKey, unknown>;
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
    emitter.onAction('core.load-format', async (_, ctx) => {
      try {
        const [format, openapi] = await loadOpenapi(logger, {
          ...defaultOpenApiPluginOptions,
          ...opts,
        });

        emitter.emit('openapi.document', openapi);

        ctx.reply(format.export());
      } catch (e) {
        ctx.error(e);
      }
    });
  },
};

export default openApiPlugin;
