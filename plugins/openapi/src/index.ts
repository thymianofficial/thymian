import { join } from 'node:path';

import {
  type PartialExceptFor,
  type ThymianNode,
  type ThymianPlugin,
} from '@thymian/core';
import type { OpenAPI } from 'openapi-types';

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
      values: { operationId: string },
    ): ThymianNode | undefined;
  }

  interface ThymianEvents {
    'openapi.document': {
      filePath: string;
      document: OpenAPI.Document;
    };
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
  allowExternalFiles: true,
  fetchExternalRefs: false,
  validateUpgrade: true,
  serverInfo: {
    port: 8080,
    host: 'localhost',
    protocol: 'http',
    basePath: '',
  },
};

export const openApiPlugin: ThymianPlugin<OpenApiPluginOptions> = {
  name: '@thymian/openapi',
  version: '0.x',
  options: {
    type: 'object',
    additionalProperties: false,
    required: ['filePath'],
    properties: {
      validateUpgrade: {
        nullable: true,
        type: 'boolean',
      },
      filePath: {
        type: 'string',
        nullable: false,
      },
      serverInfo: {
        type: 'object',
        nullable: true,
        required: ['host', 'port', 'basePath', 'protocol'],
        properties: {
          basePath: {
            type: 'string',
            nullable: false,
          },
          port: {
            type: 'integer',
            nullable: false,
          },
          host: {
            type: 'string',
            nullable: false,
          },
          protocol: {
            type: 'string',
            nullable: false,
            enum: ['http', 'https'],
          },
        },
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
    const filePath = join(opts.cwd, opts.filePath);

    emitter.onAction('core.load-format', async (_, ctx) => {
      try {
        const [format, document] = await loadOpenapi(logger, {
          ...defaultOpenApiPluginOptions,
          ...opts,
          filePath,
        });

        emitter.emit('openapi.document', {
          document,
          filePath,
        });

        ctx.reply(format.export());
      } catch (e) {
        ctx.error(e);
      }
    });
  },
};

export default openApiPlugin;
