import net from 'node:net';

import {
  type Logger,
  type ThymianActionName,
  ThymianBaseError,
  ThymianEmitter,
} from '@thymian/core';

import type { TcpMessage } from './tcp-message.js';

export type TcpServerOptions = {
  port: number;
  requiredClientNames: string[];
};

export class TcpProxyServer {
  #sockets = new Map<string, net.Socket>();
  #server: net.Server;
  #connectedClient: string[] = [];

  constructor(
    private readonly logger: Logger,
    readonly emitter: ThymianEmitter,
    readonly options: TcpServerOptions
  ) {
    this.#server = net.createServer();
  }

  run(): Promise<void> {
    this.#server.listen(this.options.port, () => {
      this.logger.info(`TCP server listening on port ${this.options.port}.`);
    });

    return this.initialize();
  }

  private initialize(): Promise<void> {
    return new Promise((resolve) => {
      this.#server.on('connection', (socket) => {
        const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
        this.#sockets.set(connectionId, socket);

        this.logger.debug(`Client connected: ${connectionId}`);

        let data = '';
        let initialized = false;

        this.emitter.events.subscribe((event) => {
          socket.write(
            JSON.stringify({
              type: 'event',
              payload: event,
            }) + '\n'
          );
        });

        this.emitter.errors.subscribe((event) => {
          socket.write(
            JSON.stringify({
              type: 'error',
              payload: event,
            }) + '\n'
          );
        });

        this.emitter.responses.subscribe((event) => {
          socket.write(
            JSON.stringify({
              type: 'response',
              payload: event,
            }) + '\n'
          );
        });

        socket.on('data', (chunk) => {
          try {
            data = data.concat(chunk.toString('utf-8'));

            const delimiterIdx = data.indexOf('\n');

            if (delimiterIdx !== -1) {
              const message = data.slice(0, delimiterIdx);
              data = data.slice(delimiterIdx + 1);

              const event = JSON.parse(message) as TcpMessage;

              let emitter = this.emitter;

              switch (event.type) {
                case 'init': {
                  if (initialized) {
                    throw new Error(`TCP server already initialized.`);
                  }

                  emitter = this.emitter.child(event.payload.name);

                  event.payload.actions.listensOn.forEach((event) => {
                    emitter.increaseListenersFor(event as ThymianActionName);
                  });

                  initialized = true;
                  this.#connectedClient.push(event.payload.name);
                  break;
                }
                case 'error':
                  emitter.errors.next(event.payload);
                  break;
                case 'event':
                  emitter.events.next(event.payload);
                  break;
                case 'response':
                  emitter.responses.next(event.payload);
                  break;
                default:
                  throw new Error(`Unknown TCP message type.`);
              }
            }
          } catch (e) {
            this.emitter.emitError(
              new ThymianBaseError(
                `Error parsing TCP initialization message: ${e}`,
                {
                  name: 'TcpMessageParseError',
                  suggestions: ['Did you send a valid JSON message?'],
                  cause: e,
                }
              )
            );
          }

          if (
            this.options.requiredClientNames.every((name) =>
              this.#connectedClient.includes(name)
            )
          ) {
            resolve();
          }
        });

        socket.on('end', () => {
          this.logger.debug(`Client disconnected: ${connectionId}`);
          this.#sockets.delete(connectionId);
        });

        socket.on('error', (err) => {
          this.logger.debug(`Error from ${connectionId}:`, err);
          this.#sockets.delete(connectionId);
        });
      });
    });
  }
}
