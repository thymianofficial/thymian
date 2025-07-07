import semver from 'semver';

import packageJson from '../package.json' with { type: 'json' };
import type { CloseActionResult } from './actions/close.action.js';
import { corePlugin } from './core-plugin.js';
import { ThymianEmitter } from './emitter/index.js';
import {  ThymianFormat } from './format/index.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { ThymianBaseError } from './thymian.error.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export type RegisteredPlugin<T> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianBaseError {}

export type ThymianOptions = {
  timeout: number
}

export class Thymian {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  readonly plugins: RegisteredPlugin<any>[] = [];

  readonly emitter: ThymianEmitter;

  readonly options: ThymianOptions;

  #ready = false;

  public static readonly VERSION = packageJson.version;

  constructor(private readonly logger: Logger = new NoopLogger(), options: Partial<ThymianOptions> = {}) {
    this.emitter = new ThymianEmitter(logger.child('ThymianEmitter'));
    this.options = {
      timeout: 5000,
      ...options
    }
  }

  register<T>(plugin: ThymianPlugin<T>, options?: T): this {
    if (!semver.satisfies(Thymian.VERSION, plugin.version)) {
      throw new PluginRegistrationError(
        `@thymian/core version ${Thymian.VERSION} does not match plugin version constraints ${plugin.version} from plugin "${plugin.name}".`, {
          suggestions: [`Install the matching plugin version for thymian version ${Thymian.VERSION}.`],
          ref: 'http://localhost:8080'
        }
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

    await this.emitter.emitAction('core.ready');

    this.#ready = true;
  }


  close(): Promise<CloseActionResult[]> {
    return this.emitter.emitAction('core.close')
  }

  async loadFormat(): Promise<ThymianFormat> {
    const formats = await this.emitter.emitAction('core.load-format')

    return formats.length === 0
      ? new ThymianFormat()
      // we know that formats.length >= 1
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      : formats.slice(1).reduce((acc, curr) => acc.merge(ThymianFormat.import(curr)), ThymianFormat.import(formats[0]!))
  }

  private async loadRegisteredPlugins(): Promise<void> {
    await this.registerPlugin({ plugin: corePlugin, options: {} })

    for (const plugin of this.plugins) {
      await this.registerPlugin(plugin);
    }
  }

  private async registerPlugin(registeredPlugin: RegisteredPlugin<any>): Promise<void> {
    this.emitter.emit('core.register', {
      name: registeredPlugin.plugin.name,
      events: registeredPlugin.plugin.events ?? {},
      options: registeredPlugin.options,
    });

    await timeoutPromise(
      registeredPlugin.plugin.plugin(this.emitter, this.logger.child(registeredPlugin.plugin.name), registeredPlugin.options),
      this.options.timeout,
      new PluginRegistrationError(`Timeout while registering plugin "${registeredPlugin.plugin.name}".`, {
        suggestions: [
          'Increase plugin timeout duration. Using the Thymian CLI try using "--timeout" to set custom timeout (default 5000ms).',
          'Check your plugin registration logic.'
        ]
      })
    );
  }
}
