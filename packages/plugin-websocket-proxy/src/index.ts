import { type Logger, ThymianEmitter, type ThymianPlugin } from '@thymian/core';

import {
  WebSocketProxyServer,
  type WebSocketProxyServerOptions,
} from './websocket-proxy-server.js';

export type WebsocketProxyOptions = Partial<WebSocketProxyServerOptions>;

export const websocketProxyPlugin: ThymianPlugin<WebsocketProxyOptions> = {
  name: '@thymian/plugin-websocket-proxy',
  version: '0.x',
  options: {
    type: 'object',
    additionalProperties: false,
    properties: {
      port: { type: 'integer', nullable: true },
      host: {
        type: 'string',
        nullable: true,
        description:
          'Interface the WebSocket server binds to. Defaults to 127.0.0.1, so the server is only reachable from the local machine.',
      },
      allowedOrigins: {
        type: 'array',
        nullable: true,
        items: { type: 'string' },
        description:
          'Browser origins that are allowed to connect. Connections from any other origin are rejected. Defaults to none.',
      },
      allowUnauthenticatedPlugins: {
        type: 'boolean',
        nullable: true,
        description:
          'Unauthenticated mode for local development: accept remote plugins that are not listed under "plugins" or have no token. Only allowed if "host" is a loopback address. Defaults to false.',
      },
      maxPayload: {
        type: 'integer',
        minimum: 1,
        nullable: true,
        description:
          'Largest message in bytes the server accepts from a remote plugin. Defaults to 33554432 (32 MiB).',
      },
      clientTimeout: {
        type: 'integer',
        minimum: 1,
        nullable: true,
        description:
          'Milliseconds a connected remote plugin has to complete the handshake (register and ready). Defaults to 4000.',
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
              minLength: 1,
              nullable: false,
            },
            required: {
              type: 'boolean',
              nullable: true,
            },
            token: {
              type: 'string',
              minLength: 1,
              nullable: true,
              description:
                'Shared secret the remote plugin sends as "Authorization: Bearer <token>" header. Required unless "allowUnauthenticatedPlugins" is enabled.',
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
    // A failure (e.g. the port is in use) is reported through `core.ready`
    // below; until that handler runs it must not be an unhandled rejection.
    ready.catch(() => undefined);

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
