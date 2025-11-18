import { type Logger, ThymianEmitter, type ThymianPlugin } from '@thymian/core';

import {
  WebSocketProxyServer,
  type WebSocketProxyServerOptions,
} from './websocket-proxy-server.js';

export type WebsocketProxyOptions = Partial<WebSocketProxyServerOptions>;

export const websocketProxyPlugin: ThymianPlugin<WebsocketProxyOptions> = {
  name: '@thymian/websocket-proxy',
  version: '0.x',
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      port: { type: 'integer', nullable: true },
      clientTimeout: {
        type: 'integer',
        nullable: true,
      },
      plugins: {
        type: 'array',
        nullable: true,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'options'],
          properties: {
            name: {
              type: 'string',
              nullable: false,
            },
            required: {
              type: 'boolean',
              nullable: true,
            },
            token: {
              type: 'string',
              nullable: true,
            },
            options: {
              type: 'object',
              additionalProperties: true,
              nullable: false,
            },
          },
        },
      },
    },
  },
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options,
  ): Promise<void> {
    const server = new WebSocketProxyServer(emitter, logger, options);

    const ready = server.start();

    emitter.onAction('core.ready', async (_, ctx) => {
      await ready;

      ctx.reply();
    });

    emitter.onAction('core.close', (_, ctx) => {
      server.stop().finally(() => ctx.reply());
    });
  },
};

export default websocketProxyPlugin;
