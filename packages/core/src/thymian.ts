import semver from 'semver';

import packageJson from '../package.json' with { type: 'json' };
import type {
  CoreFormatLoadInput,
  CoreRequestDispatchInput,
  CoreRequestSampleInput,
  CoreTrafficLoadInput,
  SpecificationInput,
  TrafficInput,
  ValidationResult,
} from './actions/index.js';
import { validate } from './ajv.js';
import { corePlugin } from './core-plugin.js';
import { ThymianEmitter } from './emitter/index.js';
import { ThymianFormat } from './format/index.js';
import type { HttpRequestTemplate, HttpResponse } from './http.js';
import { constant, type HttpFilterExpression } from './http-filter.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import {
  type LoadedTraffic,
  loadRules,
  type Rule,
  type RulesConfiguration,
} from './rules/index.js';
import { ThymianBaseError } from './thymian.error.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export interface LintWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  options?: Record<string, unknown>;
}

export interface TestWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  options?: Record<string, unknown>;
}

export interface AnalyzeWorkflowInput {
  specification?: SpecificationInput[];
  traffic: TrafficInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  options?: Record<string, unknown>;
}

export type RegisteredPlugin<
  T extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianBaseError {}

export type ThymianOptions = {
  timeout: number;
  idleTimeout: number;
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

  // Number of milliseconds that is waited for new events and actions to be emitted before shutting down the emitter.
  public static readonly DEFAULT_IDLE_TIMEOUT = 500;

  // number of milliseconds that is waited for actions response and plugin registration
  public static readonly DEFAULT_TIMEOUT = 10000;

  constructor(
    private readonly logger: Logger = new NoopLogger(),
    options: Partial<ThymianOptions> = {},
  ) {
    this.options = {
      idleTimeout: Thymian.DEFAULT_IDLE_TIMEOUT,
      timeout: Thymian.DEFAULT_TIMEOUT,
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
    // we only consider stable versions for compatibility checks, so that pre-releases
    // like 1.0.0-beta.1 are also compatible with 1.0.0
    const thymianStableVersion = Thymian.VERSION.replace(/-.*$/, '');
    if (!semver.satisfies(thymianStableVersion, plugin.version)) {
      throw new PluginRegistrationError(
        `@thymian/core version ${thymianStableVersion} does not match plugin version constraints ${plugin.version} from plugin "${plugin.name}".`,
        {
          suggestions: [
            `Install the matching plugin version for thymian version ${thymianStableVersion}.`,
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
    await this.emitter.emitAction('core.close');

    // This let the ThymianEmitter wait 500 ms for the last events to be emitted before shutting down.
    await this.emitter.shutdown(this.options.idleTimeout);

    this.emitter.completeSubjects();
  }

  async loadFormat(
    inputOrFilter: CoreFormatLoadInput | HttpFilterExpression = constant(true),
    _options: { emitFormat?: boolean } = {},
  ): Promise<ThymianFormat> {
    const options = { emitFormat: true, ..._options };

    const isCoreFormatLoadInput = (
      value: CoreFormatLoadInput | HttpFilterExpression,
    ): value is CoreFormatLoadInput =>
      typeof value === 'object' &&
      value !== null &&
      'inputs' in value &&
      Array.isArray(value.inputs);

    const filter = isCoreFormatLoadInput(inputOrFilter)
      ? constant(true)
      : inputOrFilter;

    const useNewFormatInputs = isCoreFormatLoadInput(inputOrFilter);

    const [legacyFormats, formats] = await Promise.all([
      this.emitter.emitAction(
        'core.load-format',
        { filter },
        {
          strategy: 'collect',
        },
      ),
      this.emitter.emitAction(
        'core.format.load',
        useNewFormatInputs ? inputOrFilter : { inputs: [] },
        {
          strategy: 'collect',
        },
      ),
    ]);

    const allFormats = useNewFormatInputs
      ? formats
      : legacyFormats.concat(formats);

    const format =
      allFormats.length === 0
        ? new ThymianFormat()
        : // we know that formats.length >= 1

          allFormats
            .slice(1)
            .reduce(
              (acc, curr) => acc.merge(ThymianFormat.import(curr)),
              ThymianFormat.import(allFormats[0]!),
            );

    this.logger.debug(
      `Merged Thymian format includes ${format.graph.order} nodes and ${format.graph.size} edges.`,
    );

    if (options.emitFormat) {
      await this.emitter.emitAction('core.format', format.export());
    }

    const filteredFormat = format.filter(filter);

    if (filteredFormat.graph.size === 0) {
      this.logger.warn(
        'No nodes found in Thymian format after filtering. Is this intended?',
      );
    }

    return filteredFormat;
  }

  async loadTraffic(input: CoreTrafficLoadInput): Promise<LoadedTraffic> {
    const loadedTraffic = await this.emitter.emitAction(
      'core.traffic.load',
      input,
      {
        strategy: 'collect',
      },
    );

    return loadedTraffic.reduce<LoadedTraffic>(
      (acc, current) => ({
        transactions: [
          ...(acc.transactions ?? []),
          ...(current.transactions ?? []),
        ],
        traces: [...(acc.traces ?? []), ...(current.traces ?? [])],
        metadata: {
          ...(acc.metadata ?? {}),
          ...(current.metadata ?? {}),
        },
      }),
      {},
    );
  }

  /**
   * Architectural note:
   * Core owns the public validation entrypoints and input-loading contract.
   * Plugins own the mode-specific execution semantics behind these entrypoints.
   * This keeps the consumer-facing API stable while preserving plugin-based extensibility.
   */
  async lint(input: LintWorkflowInput): Promise<ValidationResult[]> {
    const { rulesConfig } = input;

    const [format, rules] = await Promise.all([
      this.loadFormat({ inputs: input.specification }, { emitFormat: false }),
      loadRules(input.rules ?? [], undefined, rulesConfig, this.options.cwd),
    ]);

    return this.emitter.emitAction(
      'core.lint',
      { format: format.export(), rules, rulesConfig, options: input.options },
      { strategy: 'collect' },
    );
  }

  async test(input: TestWorkflowInput): Promise<ValidationResult[]> {
    const { rulesConfig } = input;

    const [format, rules] = await Promise.all([
      this.loadFormat({ inputs: input.specification }, { emitFormat: false }),
      loadRules(input.rules ?? [], undefined, rulesConfig, this.options.cwd),
    ]);

    return this.emitter.emitAction(
      'core.test',
      { format: format.export(), rules, rulesConfig, options: input.options },
      { strategy: 'collect' },
    );
  }

  async analyze(input: AnalyzeWorkflowInput): Promise<ValidationResult[]> {
    const { rulesConfig } = input;

    const [traffic, rules, format] = await Promise.all([
      this.loadTraffic({ inputs: input.traffic }),
      loadRules(input.rules ?? [], undefined, rulesConfig, this.options.cwd),
      input.specification
        ? this.loadFormat(
            { inputs: input.specification },
            { emitFormat: false },
          )
        : Promise.resolve(undefined),
    ]);

    return this.emitter.emitAction(
      'core.analyze',
      {
        traffic,
        format: format?.export(),
        rules,
        rulesConfig,
        options: input.options,
      },
      { strategy: 'collect' },
    );
  }

  async sample(input: CoreRequestSampleInput): Promise<HttpRequestTemplate> {
    return this.emitter.emitAction('core.request.sample', input, {
      strategy: 'first',
    });
  }

  async dispatch(input: CoreRequestDispatchInput): Promise<HttpResponse> {
    return this.emitter.emitAction('core.request.dispatch', input, {
      strategy: 'first',
    });
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
