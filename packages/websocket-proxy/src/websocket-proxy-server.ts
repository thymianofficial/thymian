import { randomUUID } from 'node:crypto';

import {
  type EventPayload,
  type Logger,
  type ThymianActionName,
  ThymianBaseError,
  ThymianEmitter,
  type ThymianEventName,
  type ThymianEvents,
  timeoutPromise,
} from '@thymian/core';
import sjson from 'secure-json-parse';
import { type WebSocket, WebSocketServer } from 'ws';

import { isClientToServerMessage } from './message-schemas.js';
import type {
  ActionErrorMessage,
  ActionReplyMessage,
  ClientToServerMessage,
  ServerActionMessage,
  ServerEventMessage,
  ServerToClientMessage,
} from './messages.js';
import { setContainsAll } from './utils.js';

export type WebsocketProxyPlugin = {
  name: string;
  required?: boolean;
  token?: string;
  options: Record<PropertyKey, unknown>;
};

export type WebSocketProxyServerOptions = {
  port: number;
  clientTimeout: number;
  plugins: WebsocketProxyPlugin[];
};

export type ConnectedClient = {
  name: string;
  ws: WebSocket;
  state: 'connected' | 'registered' | 'ready' | 'closed';
  events: ThymianEventName[];
  actions: ThymianActionName[];
};

export class WebSocketProxyServer {
  private readonly options: WebSocketProxyServerOptions;
  private readonly required: Set<string>;
  private readonly clients = new Map<string, ConnectedClient>();
  private wss!: WebSocketServer;
  private readonly pendingActionCtx = new Map<
    string,
    (msg: ActionReplyMessage | ActionErrorMessage) => void
  >();

  constructor(
    private readonly emitter: ThymianEmitter,
    private readonly logger: Logger,
    options: Partial<WebSocketProxyServerOptions> = {},
  ) {
    this.options = {
      port: 51234,
      plugins: [],
      clientTimeout: 4000,
      ...options,
    };
    this.required = new Set(
      this.options.plugins.filter((p) => !!p.required).map((p) => p.name),
    );
  }

  start(): Promise<void> {
    this.wss = new WebSocketServer({
      port: this.options.port,
    });

    this.wss.on('listening', () => {
      this.logger.debug(
        `@thymian/websocket-proxy listening on ws://localhost:${this.options.port}`,
      );
    });

    return new Promise((resolve, reject) => {
      this.wss.on('connection', async (ws) => {
        try {
          const connectedClient = await timeoutPromise(
            this.onConnection(ws),
            this.options.clientTimeout,
            new ThymianBaseError(
              `Cannot establish a connection to a WebSocket client within ${this.options.clientTimeout}ms.`,
              {
                suggestions: [
                  'Check if the client is running and if the port is correct.',
                  'Increase the clientTimeout option if the client takes longer to connect.',
                ],
              },
            ),
          );

          this.logger.debug(`Plugin "${connectedClient.name}" connected.`);

          this.clients.set(connectedClient.name, connectedClient);

          if (setContainsAll(this.required, Array.from(this.clients.keys()))) {
            for (const [, client] of this.clients) {
              if (client.state !== 'ready') {
                this.logger.warn(
                  `Client ${client.name} is not ready. Connection to Websocket is closed with state ${client.state}.`,
                );
              }
            }

            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      if (this.required.size === 0) {
        resolve();
      }
    });
  }

  stop(): Promise<void> {
    this.logger.debug('Shutting down WebSocket server.');

    return new Promise((resolve, reject) => {
      for (const [, client] of this.clients) {
        try {
          client.ws.close(1001, 'Server shutting down.');
        } catch (err) {
          reject(err);
        }
      }
      this.clients.clear();
      if (this.wss) {
        this.wss.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  private onConnection(ws: WebSocket): Promise<ConnectedClient> {
    const connectedClient: ConnectedClient = {
      name: '',
      ws,
      state: 'connected',
      events: [],
      actions: [],
    };
    let emitter = this.emitter;

    return new Promise((resolve) => {
      ws.on('message', async (rawMessage) => {
        const stringMessage = rawMessage.toString();

        this.logger.trace(`Received message: ${stringMessage}`);

        let message!: ClientToServerMessage;

        try {
          const parsed = sjson.parse(stringMessage);

          if (!isClientToServerMessage(parsed)) {
            this.logger.warn(
              'Received invalid JSON message. Closing socket connection.',
            );
            ws.close(1008, 'Received invalid message.');
            connectedClient.state = 'closed';
            return;
          }

          message = parsed;
        } catch (e) {
          if (e instanceof Error) {
            this.logger.error(
              `Error parsing message: ${e.message}. Closing socket connection.`,
            );
          } else {
            this.logger.error(
              `Error parsing message. Closing socket connection.`,
            );
          }

          ws.close(1003);
          connectedClient.state = 'closed';
          return;
        }

        switch (message.type) {
          case 'register': {
            if (connectedClient.state !== 'connected') {
              this.logger.warn(
                `Received register message in state '${connectedClient.state}'. Expected to be in state 'connected'. Connection to Websocket is closed.`,
              );
              ws.close(1003, 'Received invalid JSON message.');
              connectedClient.state = 'closed';
              return;
            }

            this.logger.debug(
              `Received register message from plugin "${message.name}".`,
            );

            if (this.clients.has(message.name)) {
              this.sendMessageForClient(connectedClient, {
                type: 'register-ack',
                ok: false,
                reason: 'Name already in use.',
              });
            }

            connectedClient.actions = message.onActions ?? [];
            connectedClient.events = message.onEvents ?? [];
            connectedClient.name = message.name;
            connectedClient.state = 'registered';

            const config = this.options.plugins.find(
              (p) => p.name === connectedClient.name,
            );

            if (config) {
              if (config.token && message.token !== config.token) {
                this.sendMessageForClient(connectedClient, {
                  type: 'register-ack',
                  ok: false,
                  reason: 'Invalid token.',
                });
              } else {
                this.sendMessageForClient(connectedClient, {
                  type: 'register-ack',
                  ok: true,
                  config: config.options,
                });
              }
            } else {
              this.sendMessageForClient(connectedClient, {
                type: 'register-ack',
                ok: true,
                config: {},
              });
            }

            break;
          }
          case 'ready': {
            if (connectedClient.state !== 'registered') {
              const errMsg = `Received ready message in state '${connectedClient.state}'. Expected to be in state 'registered'. Connection to Websocket is closed.`;
              this.logger.warn(errMsg);
              ws.close(1008, errMsg);
              connectedClient.state = 'closed';
              return;
            }
            emitter = this.emitter.child(connectedClient.name);
            this.registerEventsAndActionsForClient(connectedClient);

            connectedClient.state = 'ready';

            return resolve(connectedClient);
          }
          case 'emit': {
            if (connectedClient.state !== 'ready') {
              const errorMsg = `Received emit message in state '${connectedClient.state}'. Expected to be in state 'ready'. Connection to Websocket is closed.`;
              this.logger.warn(errorMsg);
              ws.close(1008, errorMsg);
              connectedClient.state = 'closed';
              return;
            }

            emitter.emit(
              message.name,
              message.payload as EventPayload<keyof ThymianEvents>,
            );
            break;
          }
          case 'emitAction': {
            if (connectedClient.state !== 'ready') {
              const errorMsg = `Received emit message in state '${connectedClient.state}'. Expected to be in state 'ready'. Connection to Websocket is closed.`;
              this.logger.warn(errorMsg);
              ws.close(1008, errorMsg);
              connectedClient.state = 'closed';
              return;
            }

            const { id, name, payload, options } = message;
            try {
              const result = await emitter.emitAction(
                name,
                payload as never,
                options,
              );

              this.sendMessageForClient(connectedClient, {
                type: 'emitActionResult',
                id,
                name,
                payload: result,
              });
            } catch (e) {
              if (e instanceof Error) {
                this.sendMessageForClient(connectedClient, {
                  type: 'emitActionError',
                  id,
                  name,
                  error: {
                    name: e?.name ?? 'Error',
                    message: e?.message ?? 'Action failed',
                  },
                });
              } else {
                this.sendMessageForClient(connectedClient, {
                  type: 'emitActionError',
                  id,
                  name,
                  error: {},
                });
              }
            }

            break;
          }
          case 'actionReply':
          case 'actionError': {
            this.pendingActionCtx.get(message.correlationId)?.(message);

            break;
          }
          default: {
            const m = message as { type: string };

            const msg = `Received invalid message type "${m.type}".`;
            ws.close(1008, msg);
            this.logger.warn(msg);
            connectedClient.state = 'closed';
            return;
          }
        }
      });
    });
  }

  private sendMessageForClient(
    connectedClient: ConnectedClient,
    data: ServerToClientMessage,
  ) {
    const stringifiedData = JSON.stringify(data);

    this.logger.trace(`Sending message: ${stringifiedData}`);

    connectedClient.ws.send(stringifiedData, (err) => {
      if (err) {
        this.logger.error(
          `Error sending message: ${err.message}. Closing socket connection.`,
        );

        connectedClient.ws.close(1002);
        connectedClient.state = 'closed';
      }
    });
  }

  private registerEventsAndActionsForClient(client: ConnectedClient): void {
    const emitter = this.emitter.child(client.name);

    for (const name of client.actions) {
      emitter.onAction(name, async (payload, ctx) => {
        const id = randomUUID();

        const onResponse = (msg: ActionReplyMessage | ActionErrorMessage) => {
          this.pendingActionCtx.delete(id);

          if (msg.type === 'actionReply') {
            ctx.reply(msg.payload as never);
          } else {
            ctx.error(msg.error);
          }
        };

        this.pendingActionCtx.set(id, onResponse);

        const message: ServerActionMessage = {
          type: 'action',
          id,
          name,
          payload,
        };

        this.sendMessageForClient(client, message);
      });
    }

    for (const name of client.events) {
      emitter.on(name, (payload) => {
        const message: ServerEventMessage = {
          type: 'event',
          name,
          payload,
        };

        this.sendMessageForClient(client, message);
      });
    }
  }
}
