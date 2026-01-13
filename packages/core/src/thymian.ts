import semver from 'semver';

import packageJson from '../package.json' with { type: 'json' };
import { validate } from './ajv.js';
import { corePlugin } from './core-plugin.js';
import { ThymianEmitter } from './emitter/index.js';
import { ThymianFormat } from './format/index.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { ThymianBaseError } from './thymian.error.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export type RegisteredPlugin<
  T extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianBaseError {}

export type ThymianOptions = {
  timeout: number;
  traceEvents: boolean;
  cwd: string;
  logAllErrors: boolean;
};

export class Thymian {
  readonly plugins: RegisteredPlugin[] = [];

  readonly emitter: ThymianEmitter;

  readonly options: ThymianOptions;

  #ready = false;

  public static readonly VERSION = packageJson.version;

  constructor(
    private readonly logger: Logger = new NoopLogger(),
    options: Partial<ThymianOptions> = {},
  ) {
    this.options = {
      timeout: 5000,
      traceEvents: false,
      cwd: process.cwd(),
      logAllErrors: false,
      ...options,
    };

    const emitterLogger = logger.child(
      '@thymian/core',
      this.options.traceEvents,
    );
    this.emitter = new ThymianEmitter(
      emitterLogger,
      ThymianEmitter.emptyEmitterState('@thymian/core'),
      {
        traceEvents: this.options.traceEvents,
        timeout: this.options.timeout,
      },
    );
  }

  register<T extends Record<PropertyKey, unknown>>(
    plugin: ThymianPlugin<T>,
    options?: T,
  ): this {
    if (!semver.satisfies(Thymian.VERSION, plugin.version)) {
      throw new PluginRegistrationError(
        `@thymian/core version ${Thymian.VERSION} does not match plugin version constraints ${plugin.version} from plugin "${plugin.name}".`,
        {
          suggestions: [
            `Install the matching plugin version for thymian version ${Thymian.VERSION}.`,
          ],
        },
      );
    }

    if (plugin.options && options) {
      const validOptions = validate(plugin.options, options);

      if (!validOptions) {
        throw new PluginRegistrationError(
          `Invalid options for plugin "${plugin.name}".`,
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.plugins.push({ plugin: plugin, options: options ?? {} });

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

  run<T>(
    fn: (emitter: ThymianEmitter, logger: Logger) => Promise<T> | T,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let closed = false;

      const tryCloseThymian = (err: unknown) => {
        if (closed) {
          return;
        }
        closed = true;

        this.logger.debug('Try closing Thymian...');
        this.close()
          .then(() => {
            this.logger.debug('Thymian closed.');
            reject(err);
          })
          .catch((e) => {
            this.logger.error('Error while closing Thymian.', e);
            reject(err);
          });
      };

      this.emitter.onError((event) => {
        if (closed && this.options.logAllErrors) {
          this.logger
            .child(event.source)
            [event.error.options.severity](event.error.message);
        }

        if (event.error.options.severity === 'error') {
          tryCloseThymian(event.error);
        }
      });

      (async () => {
        await this.ready();

        const result = await fn(this.emitter, this.logger);

        await this.close();

        return result;
      })()
        .then(resolve)
        .catch((err) => {
          tryCloseThymian(err);
        });
    });
  }

  async close(): Promise<void> {
    await this.emitter.shutdown(1000, 1100);

    await this.emitter.emitAction('core.close');

    this.emitter.completeSubjects();
  }

  async loadFormat(
    _options: { emitFormat?: boolean } = {},
  ): Promise<ThymianFormat> {
    const options = { emitFormat: true, ..._options };

    const formats = await this.emitter.emitAction(
      'core.load-format',
      undefined,
      {
        strategy: 'collect',
      },
    );

    const format =
      formats.length === 0
        ? new ThymianFormat()
        : // we know that formats.length >= 1

          formats
            .slice(1)
            .reduce(
              (acc, curr) => acc.merge(ThymianFormat.import(curr)),
              ThymianFormat.import(formats[0]!),
            );

    this.logger.debug(
      `Merged Thymian format includes ${format.graph.order} nodes and ${format.graph.size} edges.`,
    );

    if (options.emitFormat) {
      await this.emitter.emitAction('core.format', format.export());
    }

    return format;
  }

  private async loadRegisteredPlugins(): Promise<void> {
    await this.registerPlugin({
      plugin: corePlugin,
      options: { cwd: this.options.cwd },
    });

    for (const plugin of this.plugins) {
      await this.registerPlugin(plugin);
    }
  }

  private async registerPlugin(
    registeredPlugin: RegisteredPlugin,
  ): Promise<void> {
    this.logger.debug(
      `Register plugin ${registeredPlugin.plugin.name} with options ${JSON.stringify(registeredPlugin.options)}`,
    );

    this.emitter.emit('core.register', {
      name: registeredPlugin.plugin.name,
      events: registeredPlugin.plugin.events ?? {},
      options: registeredPlugin.options,
    });

    await timeoutPromise(
      registeredPlugin.plugin.plugin(
        this.emitter.child(registeredPlugin.plugin.name),
        this.logger.child(registeredPlugin.plugin.name),
        { ...registeredPlugin.options, cwd: this.options.cwd },
      ),
      this.options.timeout,
      new PluginRegistrationError(
        `Timeout while registering plugin "${registeredPlugin.plugin.name}".`,
        {
          suggestions: [
            'Increase plugin timeout duration. Using the Thymian CLI try using "--timeout" to set custom timeout (default 5000ms).',
            'Check your plugin registration logic.',
          ],
        },
      ),
    );
  }
}
