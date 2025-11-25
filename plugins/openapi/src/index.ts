import { join } from 'node:path';

import {
  type SerializedThymianFormat,
  type ThymianNode,
  type ThymianPlugin,
} from '@thymian/core';
import type { OpenAPI } from 'openapi-types';

import { loadAndTransform } from './load-openapi.js';
import type { ServerInfo } from './processors/extract-server-info.js';

declare module '@thymian/core' {
  interface ThymianHttpRequest {
    extensions: {
      openapi: {
        operationId?: string;
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

  interface ThymianActions {
    'openapi.transform': {
      event: {
        content: string;
      };
      response: SerializedThymianFormat;
    };
  }
}

export type OpenApiPluginOptions = {
  serverInfo?: ServerInfo;
  filePath: string;
};

export const defaultServerInfo: ServerInfo = {
  port: 8080,
  host: 'localhost',
  protocol: 'http',
  basePath: '',
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
    },
  },
  plugin: async (emitter, logger, opts) => {
    const filePath = join(opts.cwd, opts.filePath);

    emitter.onAction('openapi.transform', async ({ content }, ctx) => {
      const [, thymianFormat] = await loadAndTransform(content, {
        logger,
        serverInfo: opts.serverInfo ?? defaultServerInfo,
      });

      ctx.reply(thymianFormat.export());
    });

    emitter.onAction('core.load-format', async (_, ctx) => {
      const [document, thymianFormat] = await loadAndTransform(filePath, {
        logger,
        serverInfo: opts.serverInfo ?? defaultServerInfo,
        filePath,
      });

      emitter.emit('openapi.document', {
        document,
        filePath,
      });

      ctx.reply(thymianFormat.export());
    });
  },
};

export default openApiPlugin;
