import type { Logger } from './logger/logger.js';
import type { ThymianPlugin } from './plugin.js';
import { ThymianEmitter } from './thymian-emitter.js';
import type { ThymianError } from './thymian.error.js';

export type RegisteredPlugin<T> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export type CoreReturnType = unknown;

export class Thymian {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private readonly plugins: RegisteredPlugin<any>[] = [];

  private readonly emitter: ThymianEmitter;

  constructor(private readonly logger: Logger) {
    this.emitter = new ThymianEmitter(logger.child('ThymianEmitter'));
  }

  register<T>(plugin: ThymianPlugin<T>, options?: T): this {
    this.logger.debug(`Register plugin ${plugin.name}.`);

    this.plugins.push({ plugin: plugin, options: options });

    return this;
  }

  async start(): Promise<CoreReturnType> {
    return new Promise((resolve, reject) => {
      this.emitter.on('thymian.error', (error: ThymianError) => {
        this.logger.error(error.message);
        reject(error);
      });

      (async () => {
        try {
          this.logger.debug('Load plugins.');

          await this.loadRegisteredPlugins();

          await this.emitter.emitAsync('thymian.ready');

          this.emitter.emit('thymian.start');

          await this.emitter.onIdle();

          const results = await this.emitter.emitAsync<CoreReturnType>(
            'thymian.close'
          );
          resolve(results);
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  private async loadRegisteredPlugins(): Promise<void> {
    for await (const { plugin, options } of this.plugins) {
      this.emitter.emit('thymian.register', {
        name: plugin.name,
        events: plugin.events,
        options,
      });

      await plugin.plugin(
        this.emitter,
        this.logger.child(plugin.name),
        options
      );
    }
  }
}
