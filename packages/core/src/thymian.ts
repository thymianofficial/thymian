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
  WorkflowClassification,
  WorkflowOutcome,
} from './actions/index.js';
import { validate } from './ajv.js';
import { corePlugin } from './core-plugin.js';
import { ThymianEmitter } from './emitter/index.js';
import type {
  ThymianReport,
  ThymianReportItem,
  ThymianReportLocation,
  ThymianReportSection,
} from './events/report.event.js';
import { ThymianFormat } from './format/index.js';
import type { HttpRequestTemplate, HttpResponse } from './http.js';
import type { LogLevel } from './logger/log-level.js';
import { shouldLog } from './logger/log-level.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { type ReportSortMode, sortReports } from './report-sorter.js';
import {
  type LoadedTraffic,
  loadRules,
  type RuleFilter,
  type RulesConfiguration,
} from './rules/index.js';
import { resolveViolationLocation } from './rules/rule-runner.js';
import type { EvaluatedRuleViolation } from './rules/rule-violation.js';
import { ThymianBaseError } from './thymian.error.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export interface LintWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  ruleFilter?: RuleFilter;
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
}

export interface TestWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  ruleFilter?: RuleFilter;
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
  targetUrl?: string;
}

export interface AnalyzeWorkflowInput {
  specification?: SpecificationInput[];
  traffic: TrafficInput[];
  rules?: string[];
  rulesConfig?: RulesConfiguration;
  ruleFilter?: RuleFilter;
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
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
  logLevel?: LogLevel;
  sortReportsBy?: ReportSortMode;
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
    const logLevel = options.logLevel ?? logger.level;
    const traceEvents = options.traceEvents ?? shouldLog('trace', logLevel);

    this.options = {
      idleTimeout: Thymian.DEFAULT_IDLE_TIMEOUT,
      timeout: Thymian.DEFAULT_TIMEOUT,
      cwd: process.cwd(),
      logAllErrors: false,
      logLevel,
      ...options,
      traceEvents,
    };

    const emitterLogger = logger.child('@thymian/core');
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

    this.logger.info('Loading plugins...');
    await this.loadRegisteredPlugins();

    await this.emitter.emitAction('core.ready');

    this.logger.info(
      `Thymian ready (${this.plugins.length} plugin(s) loaded).`,
    );
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
    input: CoreFormatLoadInput,
    _options: { emitFormat?: boolean } = {},
  ): Promise<ThymianFormat> {
    const options = { emitFormat: true, ..._options };

    this.logger.info(
      `Loading format from ${input.inputs?.length ?? 0} specification(s)...`,
    );

    const formats = await this.emitter.emitAction('core.format.load', input, {
      strategy: 'collect',
    });

    const format =
      formats.length === 0
        ? new ThymianFormat()
        : formats
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

    if (format.graph.size === 0) {
      this.logger.warn('No nodes found in Thymian format. Is this intended?');
    }

    return format;
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
  async lint(input: LintWorkflowInput): Promise<WorkflowOutcome> {
    const { rulesConfig, ruleFilter } = input;

    this.logger.info('Loading specification and rules...');

    const [format, rules] = await Promise.all([
      this.loadFormat(
        {
          inputs: input.specification,
          validateSpecs: input.validateSpecs ?? false,
        },
        { emitFormat: false },
      ),
      loadRules(input.rules ?? [], ruleFilter, rulesConfig, this.options.cwd),
    ]);

    this.logger.info(
      `Loaded ${rules.length} rule(s). Running lint workflow...`,
    );

    const results = await this.emitter.emitAction(
      'core.lint',
      { format: format.export(), rules, rulesConfig, options: input.options },
      { strategy: 'collect' },
    );

    this.bridgeReports(results, format);

    const classification = this.classifyResults(results);
    this.logger.info(`Lint complete: ${classification}.`);

    return {
      classification,
      text: await this.flushReportText(),
      results,
    };
  }

  async test(input: TestWorkflowInput): Promise<WorkflowOutcome> {
    const { rulesConfig, ruleFilter } = input;

    const [format, rules] = await Promise.all([
      this.loadFormat({
        inputs: input.specification,
        validateSpecs: input.validateSpecs ?? false,
      }),
      loadRules(input.rules ?? [], ruleFilter, rulesConfig, this.options.cwd),
    ]);

    const results = await this.emitter.emitAction(
      'core.test',
      {
        format: format.export(),
        rules,
        rulesConfig,
        options: input.options,
        targetUrl: input.targetUrl,
      },
      { strategy: 'collect' },
    );

    this.bridgeReports(results, format);

    return {
      classification: this.classifyResults(results),
      text: await this.flushReportText(),
      results,
    };
  }

  async analyze(input: AnalyzeWorkflowInput): Promise<WorkflowOutcome> {
    const { rulesConfig, ruleFilter } = input;

    const [traffic, rules, format] = await Promise.all([
      this.loadTraffic({ inputs: input.traffic }),
      loadRules(input.rules ?? [], ruleFilter, rulesConfig, this.options.cwd),
      input.specification
        ? this.loadFormat(
            {
              inputs: input.specification,
              validateSpecs: input.validateSpecs ?? false,
            },
            { emitFormat: false },
          )
        : Promise.resolve(undefined),
    ]);

    const results = await this.emitter.emitAction(
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

    this.bridgeReports(results, format ?? new ThymianFormat());

    return {
      classification: this.classifyResults(results),
      text: await this.flushReportText(),
      results,
    };
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

  private bridgeReports(
    results: ValidationResult[],
    format: ThymianFormat,
  ): void {
    // Collect all reports first so sorting can operate across them
    const reports: ThymianReport[] = [];

    for (const result of results) {
      if (result.violations.length > 0) {
        reports.push(
          this.createReportFromViolations(
            result.source,
            result.violations,
            format,
            result,
          ),
        );
      }
    }

    // Apply sort mode reshaping before emission
    const sorted = sortReports(reports, this.options.sortReportsBy);

    for (const report of sorted) {
      this.emitter.emit('core.report', report);
    }
  }

  private classifyResults(results: ValidationResult[]): WorkflowClassification {
    if (results.some((result) => result.status === 'error')) {
      return 'tool-error';
    }

    if (results.some((result) => result.status === 'failed')) {
      return 'findings';
    }

    return 'clean-run';
  }

  private async flushReportText(): Promise<string | undefined> {
    const [flushResult] = await this.emitter.emitAction(
      'core.report.flush',
      undefined,
      { strategy: 'collect' },
    );

    return flushResult?.text;
  }

  private createReportFromViolations(
    source: string,
    violations: EvaluatedRuleViolation[],
    format: ThymianFormat,
    result: ValidationResult,
  ): ThymianReport {
    let message = '';
    if (result.statistics) {
      message = `${result.statistics.rulesRun} HTTP rules run successfully. ${result.statistics.rulesWithViolations} rules reported a violation.`;
    }

    // Group violations by their resolved location heading
    const sectionMap = new Map<
      string,
      { location?: ThymianReportLocation; items: ThymianReportItem[] }
    >();

    for (const { ruleName, severity, violation } of violations) {
      const { heading, location } = resolveViolationLocation(
        violation,
        format,
        ruleName,
      );

      let section = sectionMap.get(heading);

      if (!section) {
        section = { location, items: [] };
        sectionMap.set(heading, section);
      }

      const item: ThymianReportItem = {
        severity,
        message: violation.message,
        ruleName,
        location,
      };

      section.items.push(item);
    }

    const sections: ThymianReportSection[] = [];

    for (const [heading, { location, items }] of sectionMap) {
      sections.push({ heading, items, location });
    }

    return {
      source,
      message,
      sections,
      metadata: result.metadata,
    };
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
    this.logger.info(`Registering plugin: ${registeredPlugin.plugin.name}`);
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
