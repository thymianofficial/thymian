import type { Logger } from './logger/logger.js';
import type { ThymianPlugin } from './plugin.js';
import { ThymianEmitter } from './thymian-emitter.js';
import { ThymianError } from './thymian.error.js';
import { timeoutPromise } from './utils.js';
import semver from 'semver';
import packageJson from '../package.json' assert { type: 'json' };

declare module './thymian-emitter.js' {
  interface ThymianEvents {
    'thymian.register': [Record<PropertyKey, unknown>];
    'thymian.start': [];
  }

  interface ThymianHooks {
    'thymian.close': {
      args: [];
      returnType: never;
    };
    'thymian.ready': {
      args: [];
      returnType: never;
    };
  }
}

const VERSION = packageJson.version;

export type RegisteredPlugin<T> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianError {}

export type CoreReturnType = unknown;

export class Thymian {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private readonly plugins: RegisteredPlugin<any>[] = [];

  readonly emitter: ThymianEmitter;

  public static readonly VERSION = VERSION;

  constructor(private readonly logger: Logger) {
    this.emitter = new ThymianEmitter(logger.child('ThymianEmitter'));
  }

  register<T>(plugin: ThymianPlugin<T>, options?: T): this {
    if (!semver.satisfies(Thymian.VERSION, plugin.version)) {
      throw new PluginRegistrationError(
        `@thymian/core version "${VERSION}" does not match plugin version constraints "${plugin.version}" from plugin "${plugin.name}".`
      );
    }

    this.logger.debug(`Register plugin ${plugin.name}.`);

    this.plugins.push({ plugin: plugin, options: options });

    return this;
  }

  async start(): Promise<CoreReturnType> {
    return new Promise((resolve, reject) => {
      this.emitter.onEvent('thymian.error', (error: ThymianError) => {
        this.logger.error(error.message);
        reject(error);
      });

      (async () => {
        try {
          this.logger.debug('Load plugins.');

          await this.loadRegisteredPlugins();

          await this.emitter.runHook('thymian.ready');

          this.emitter.emitEvent('thymian.start');

          await this.emitter.onIdle();

          const results = await this.emitter.runHook('thymian.close');
          resolve(results);
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  async loadRegisteredPlugins(): Promise<void> {
    for await (const { plugin, options } of this.plugins) {
      this.emitter.emitEvent('thymian.register', {
        name: plugin.name,
        events: plugin.events,
        options,
      });

      try {
        await timeoutPromise(
          plugin.plugin(this.emitter, this.logger.child(plugin.name), options),
          5000,
          new ThymianError('Plugin registration timed out.')
        );
      } catch (e) {
        throw new PluginRegistrationError(
          `Error while registering plugin "${plugin.name}".`,
          e
        );
      }
    }
  }
}
