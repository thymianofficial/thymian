import { WebSocket } from 'ws';

import { RegisterAckMessage, ServerToClientMessage } from '../src/messages';

export class ReferenceClient {
  private socket!: WebSocket;
  private readonly eventHandlers: Map<string, (payload: unknown) => void> =
    new Map();
  private readonly actionHandlers: Map<
    string,
    (payload: unknown) => Promise<unknown> | unknown
  > = new Map();
  private readonly messageHandlers: Map<
    ServerToClientMessage['type'],
    (payload: unknown) => void
  > = new Map();
  options!: { key: string };
  private readonly pendingActionResults: Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: unknown) => void }
  > = new Map();
  private initResolve!: () => void;

  constructor(
    private readonly port: number,
    private readonly name: string,
    private readonly actions: string[],
    private readonly events: string[],
  ) {
    this.messageHandlers.set('register-ack', (message: RegisterAckMessage) => {
      if (message.ok) {
        this.options = message.config as { key: string };

        this.socket.send(
          JSON.stringify({
            type: 'ready',
          }),
        );
      }

      this.initResolve();
    });
    this.messageHandlers.set(
      'event',
      (message: { name: string; payload: unknown }) => {
        const handler = this.eventHandlers.get(message.name);
        if (handler) {
          handler(message.payload);
        }
      },
    );
    this.messageHandlers.set(
      'action',
      (message: { name: string; payload: unknown; id: string }) => {
        const handler = this.actionHandlers.get(message.name);
        if (handler) {
          Promise.resolve(handler(message.payload)).then((result) => {
            this.socket.send(
              JSON.stringify({
                type: 'actionReply',
                correlationId: message.id,
                payload: result,
                name: message.name,
              }),
            );
          });
        }
      },
    );
    this.messageHandlers.set(
      'emitActionResult',
      (message: { name: string; payload: unknown; id: string }) => {
        this.pendingActionResults.get(message.id)?.resolve(message.payload);
      },
    );

    this.messageHandlers.set(
      'emitActionError',
      (message: {
        name: string;
        error: { name?: string; message?: string };
        id: string;
      }) => {
        this.pendingActionResults.get(message.id)?.reject(message.error);
      },
    );
  }

  init(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = new WebSocket(`ws://127.0.0.1:${this.port}`);

      this.socket.on('error', console.error);

      this.socket.on('open', () => {
        this.socket.send(
          JSON.stringify({
            type: 'register',
            name: this.name,
            onActions: this.actions,
            onEvents: this.events,
          }),
        );

        this.initResolve = resolve;
      });

      this.socket.on('message', (data) => {
        const message = JSON.parse(data.toString()) as {
          type: ServerToClientMessage['type'];
        };

        this.messageHandlers.get(message.type)?.(message);
      });
    });
  }

  close(): void {
    this.socket.close();
  }

  emitEvent(name: string, payload: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.send(
        JSON.stringify({
          type: 'emit',
          name,
          payload,
        }),
        (err) => {
          if (err) {
            reject(err);
          }
        },
      );

      resolve();
    });
  }

  onEvent(name: string, cb: (payload: unknown) => void): void {
    this.eventHandlers.set(name, cb);
  }

  onAction(
    name: string,
    cb: (payload: unknown) => Promise<unknown> | unknown,
  ): void {
    this.actionHandlers.set(name, cb);
  }

  emitAction<T = unknown>(
    name: string,
    payload: unknown,
    options: {
      strategy?: 'first' | 'collect' | 'deep-merge';
      timeout?: number;
    },
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();

      this.socket.send(
        JSON.stringify({
          type: 'emitAction',
          name,
          id,
          payload,
          options,
        }),
        (err) => {
          if (err) {
            reject(err);
          }
        },
      );

      this.pendingActionResults.set(id, { resolve, reject });
    });
  }
}
