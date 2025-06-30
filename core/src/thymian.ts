import semver from 'semver';

import packageJson from '../package.json' with { type: 'json' };
import type { RegisterPluginEvent } from './events/register-plugin.event.js';
import { ThymianFormat } from './format/index.js';
import type { CloseHook, CloseHookResult } from './hooks/close.hook.js';
import type { EmptyHook } from './hooks/hook.js';
import type { LoadFormatHook } from './hooks/load-format.hook.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { ThymianError } from './thymian.error.js';
import { ThymianEmitter } from './thymian-emitter.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export type RegisteredPlugin<T> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianError {}

export class Thymian {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  readonly plugins: RegisteredPlugin<any>[] = [];

  readonly emitter: ThymianEmitter;

  #ready = false;

  public static readonly VERSION = packageJson.version;

  constructor(private readonly logger: Logger = new NoopLogger()) {
    this.emitter = new ThymianEmitter(logger.child('ThymianEmitter'));
  }

  register<T>(plugin: ThymianPlugin<T>, options?: T): this {
    if (!semver.satisfies(Thymian.VERSION, plugin.version)) {
      throw new PluginRegistrationError(
        `@thymian/core version ${Thymian.VERSION} does not match plugin version constraints ${plugin.version} from plugin "${plugin.name}".`
      );
    }

    this.logger.debug(`Register plugin ${plugin.name}.`);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.plugins.push({ plugin: plugin, options: options });

    return this;
  }

  async ready(): Promise<void> {
    if (this.#ready) {
      return;
    }

    await this.loadRegisteredPlugins();

    await this.emitter.runHook('core.ready');

    this.#ready = true;
  }


  close(): Promise<CloseHookResult[]> {
    return this.emitter.runHook('core.close')
  }

  async loadFormat(): Promise<ThymianFormat> {
    const formats = await this.emitter.runHook('core.load-format');

    if (formats.length === 0) {
      return new ThymianFormat();
    }

    return formats
      .slice(1)
      .reduce((acc, curr) =>
        acc.merge(ThymianFormat.import(curr)),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ThymianFormat.import(formats[0]!)
      )
  }

  private async loadRegisteredPlugins(): Promise<void> {
    for (const { plugin, options } of this.plugins) {
      this.emitter.emitEvent('core.register', {
        name: plugin.name,
        events: plugin.events ?? {},
        hooks: plugin.hooks ?? {},
        options,
      });

      await timeoutPromise(
        plugin.plugin(this.emitter, this.logger.child(plugin.name), options),
        5000,
        new ThymianError(`Timeout while registering plugin "${plugin.name}".`)
      );
    }
  }
}
