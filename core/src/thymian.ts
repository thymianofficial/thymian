import semver from 'semver';

import packageJson from '../package.json' assert { type: 'json' };
import type { RegisterPluginEvent } from './events/register-plugin.event.js';
import type { RunEvent } from './events/run.event.js';
import { ThymianFormat } from './format/index.js';
import type { CloseHook, CloseHookResult } from './hooks/close.hook.js';
import type { EmptyHook } from './hooks/hook.js';
import type { LoadFormatHook } from './hooks/load-format.hook.js';
import type { Logger } from './logger/logger.js';
import type { ThymianPlugin } from './plugin.js';
import { ThymianError } from './thymian.error.js';
import { ThymianEmitter } from './thymian-emitter.js';
import { timeoutPromise } from './utils.js';

declare module './thymian-emitter.js' {
  interface ThymianEvents {
    'core.register-plugin': RegisterPluginEvent;
    'core.run': RunEvent;
  }

  interface ThymianHooks {
    'core.close': CloseHook;
    'core.ready': EmptyHook;
    'core.load-format': LoadFormatHook;
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

  async ready(): Promise<void> {
    await this.loadRegisteredPlugins();
  }

  async run(): Promise<CloseHookResult[]> {
    this.emitter.onError(() => {
      // TODO error handling
      throw new Error();
    });

    await this.ready();

    const format = (await this.emitter.runHook('core.load-format')).reduce(
      (format, serialized) => format.merge(ThymianFormat.import(serialized)),
      new ThymianFormat()
    );

    this.emitter.emitEvent('core.run', format.export());

    await this.emitter.onIdle();

    return await this.emitter.runHook('core.close');
  }

  private async loadRegisteredPlugins(): Promise<void> {
    for await (const { plugin, options } of this.plugins) {
      this.emitter.emitEvent('core.register', {
        name: plugin.name,
        events: plugin.events ?? {},
        hooks: plugin.hooks ?? {},
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
