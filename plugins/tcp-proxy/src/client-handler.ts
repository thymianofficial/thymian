import net from 'node:net';

import {
  type ErrorName,
  type Logger,
  type ThymianActionName,
  ThymianBaseError,
  type ThymianEmitter,
  type ThymianErrorEvent,
  type ThymianEvent,
  type ThymianEventName,
  type ThymianResponseEvent,
} from '@thymian/core';

import type { TcpMessage } from './tcp-message.js';

export class ClientHandler {
  constructor(
    private readonly socket: net.Socket,
    private readonly emitter: ThymianEmitter,
    private readonly logger: Logger
  ) {}

  connect(): Promise<string> {
    let data = '';
    let initialized = false;

    this.emitter.events.subscribe((event) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.sendTcpMessage('event', event);
    });

    this.emitter.errors.subscribe((event) => {
      this.sendTcpMessage('error', event);
    });

    this.emitter.responses.subscribe((event) => {
      this.sendTcpMessage('response', event);
    });

    return new Promise((resolve) => {
      this.socket.on('data', (chunk) => {
        try {
          data = data.concat(chunk.toString('utf-8'));

          let delimiterIdx = data.indexOf('\n');

          while (delimiterIdx !== -1) {
            const message = data.slice(0, delimiterIdx);
            data = data.slice(delimiterIdx + 1);

            if (message.trim().length === 0) {
              delimiterIdx = data.indexOf('\n');
              continue;
            }

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
                resolve(event.payload.name);
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

            delimiterIdx = data.indexOf('\n');
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
      });

      this.socket.on('end', () => {
        this.logger.debug(`Client disconnected.`);
        // this.#sockets.delete(connectionId);
      });

      this.socket.on('error', (err) => {
        this.logger.debug(`Error:`, err);
        // this.#sockets.delete(connectionId);
      });
    });
  }

  private sendTcpMessage<T extends 'event' | 'error' | 'response'>(
    type: T,
    payload: T extends 'event'
      ? ThymianEvent<ThymianEventName>
      : T extends 'error'
      ? ThymianErrorEvent<ErrorName>
      : ThymianResponseEvent<ThymianActionName>
  ): void {
    this.socket.write(
      JSON.stringify({
        type,
        payload,
      }) + '\n'
    );
  }
}
