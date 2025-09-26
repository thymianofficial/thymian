import net from 'node:net';

import { type Logger, ThymianEmitter, timeoutPromise } from '@thymian/core';

import { ClientHandler } from './client-handler.js';

export type TcpServerOptions = {
  port: number;
  requiredClientNames: string[];
  timeout: number;
};

export class TcpProxyServer {
  #server: net.Server;

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

    return timeoutPromise(this.waitForClients(), this.options.timeout);
  }

  private waitForClients(): Promise<void> {
    const connectedClientNames = new Set<string>();

    return new Promise((resolve) => {
      this.#server.on('connection', async (socket) => {
        const clientHandler = new ClientHandler(
          socket,
          this.emitter,
          this.logger
        );

        const name = await clientHandler.connect();

        connectedClientNames.add(name);

        if (
          connectedClientNames.size === this.options.requiredClientNames.length
        ) {
          resolve();
        }
      });
    });
  }
}
