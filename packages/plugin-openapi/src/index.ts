import {
  constant,
  type HttpFilterExpression,
  type SerializedThymianFormat,
  ThymianFormat,
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
      document: OpenAPI.Document;
      filePath?: string;
    };
  }

  interface ThymianActions {
    'openapi.transform': {
      event: {
        filter?: HttpFilterExpression;
        content: string;
      };
      response: SerializedThymianFormat;
    };
  }
}

export const defaultServerInfo: ServerInfo = {
  port: 8080,
  host: 'localhost',
  protocol: 'http',
  basePath: '',
};

export const openApiPlugin: ThymianPlugin = {
  name: '@thymian/plugin-openapi',
  version: '0.x',
  plugin: async (emitter, logger, opts) => {
    emitter.onAction('openapi.transform', async ({ content, filter }, ctx) => {
      const [, thymianFormat] = await loadAndTransform(content, {
        logger,
        serverInfo: defaultServerInfo,
        cwd: opts.cwd,
        filter: filter ?? constant(true),
      });

      ctx.reply(thymianFormat.export());
    });

    emitter.onAction(
      'core.format.load',
      async ({ inputs, validateSpecs }, ctx) => {
        let format = new ThymianFormat();

        const descriptions = inputs.length
          ? inputs
              .filter((input) => input.type === 'openapi')
              .map((input) => ({
                source: String(input.location),
                sourceName:
                  typeof input.options?.['sourceName'] === 'string'
                    ? input.options['sourceName']
                    : undefined,
                serverInfo:
                  typeof input.options?.['serverInfo'] === 'object' &&
                  input.options['serverInfo'] !== null
                    ? (input.options['serverInfo'] as ServerInfo)
                    : undefined,
              }))
          : [];

        if (descriptions.length === 0) {
          ctx.reply(format.export());
          return;
        }

        for (const description of descriptions) {
          const [document, thymianFormat, filePath] = await loadAndTransform(
            description.source,
            {
              logger,
              format,
              serverInfo: description.serverInfo ?? defaultServerInfo,
              sourceName: description.sourceName,
              cwd: opts.cwd,
              filter: constant(true),
              validateSpecs,
            },
          );
          format = thymianFormat;

          emitter.emit('openapi.document', {
            document,
            filePath,
          });
        }

        ctx.reply(format.export());
      },
    );
  },
};

export default openApiPlugin;

export { searchForOpenApiFiles } from './search-for-openapi-files.js';
