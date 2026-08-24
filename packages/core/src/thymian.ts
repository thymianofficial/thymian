import semver from 'semver';

import packageJson from '../package.json' with { type: 'json' };
import type {
  ConvertedRunFragment,
  CoreAnalyzeInput,
  CoreFormatLoadInput,
  CoreRequestDispatchInput,
  CoreRequestSampleInput,
  CoreTrafficLoadInput,
  ReportInput,
  SpecificationInput,
  SpecValidationOutcome,
  SpecValidationResult,
  TrafficInput,
} from './actions/index.js';
import {
  workflowAnalyzeActionSchema,
  workflowLintActionSchema,
  workflowTestActionSchema,
} from './actions/index.js';
import { ajv, formatAjvErrors, type JSONSchemaType, validate } from './ajv.js';
import { corePlugin } from './core-plugin.js';
import { ThymianEmitter } from './emitter/index.js';
import { ThymianFormat } from './format/index.js';
import type { HttpRequestTemplate, HttpResponse } from './http.js';
import type { LogLevel } from './logger/log-level.js';
import { shouldLog } from './logger/log-level.js';
import type { Logger } from './logger/logger.js';
import { NoopLogger } from './logger/noop.logger.js';
import { createReport, type Report, type ToolRun } from './report/index.js';
import {
  type LoadedTraffic,
  loadRules,
  type RuleFilter,
  type RulesConfiguration,
} from './rules/index.js';
import { ThymianBaseError } from './thymian.error.js';
import type { ThymianPlugin } from './thymian-plugin.js';
import { timeoutPromise } from './utils.js';

export interface LintWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  ruleProfiles?: Record<string, string>;
  rulesConfig?: RulesConfiguration;
  ruleFilter?: RuleFilter;
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
}

export interface TestWorkflowInput {
  specification: SpecificationInput[];
  rules?: string[];
  ruleProfiles?: Record<string, string>;
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
  ruleProfiles?: Record<string, string>;
  rulesConfig?: RulesConfiguration;
  ruleFilter?: RuleFilter;
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
  validateTrafficSource?: boolean;
}

export interface ReportConvertWorkflowInput {
  reports: ReportInput[];
  specification?: SpecificationInput[];
  options?: Record<string, unknown>;
  validateSpecs?: boolean;
}

export interface ReportConvertOutcome {
  report: Report;
  /**
   * Report inputs no registered listener claimed, derived from the union of
   * `core.report.convert` replies (ADR-0016/0017). Never thrown — enforcement
   * (a usage error naming the input) is the caller's job (CLI, Story 14.2).
   */
  unclaimed: ReportInput[];
}

export interface ValidateWorkflowInput {
  specification: SpecificationInput[];
}

export type RegisteredPlugin<
  T extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> = {
  plugin: ThymianPlugin<T>;
  options: T;
};

export class PluginRegistrationError extends ThymianBaseError {}

export type ThymianOptions = {
  timeout?: number;
  idleTimeout: number;
  traceEvents: boolean;
  cwd: string;
  logAllErrors: boolean;
  logLevel?: LogLevel;
};

export class Thymian {
  readonly plugins: RegisteredPlugin[] = [];

  readonly emitter: ThymianEmitter;

  readonly options: ThymianOptions;

  #ready = false;

  public static readonly VERSION = packageJson.version;

  // Number of milliseconds that is waited for new events and actions to be emitted before shutting down the emitter.
  public static readonly DEFAULT_IDLE_TIMEOUT = 500;

  public static readonly DEFAULT_TEST_TIMEOUT = 1000 * 60 * 5;

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

    // Expose the whole-workflow entrypoints as WS-reachable actions. Unlike the
    // detail actions (core.lint/test/analyze, handled by plugins), these are
    // handled here because they route to this instance's lint()/test()/
    // analyze(). The emit/WS path does not validate payloads against the
    // declared schema, so each handler validates its own input first.
    //
    // Trust boundary: these actions run whole workflows (test() issues outbound
    // HTTP to a caller-supplied targetUrl) in a single WS call. That is a
    // deliberate, marginal expansion of an already trusted-local WS surface —
    // core.format.load / core.traffic.load / core.request.dispatch are already
    // WS-reachable — not a new boundary.
    //
    // Caller-side timeout contract: the outer emitAction reply window is the
    // *caller's* options.timeout (default DEFAULT_TIMEOUT = 10s). test()/
    // analyze() can run far longer (test() runs core.test with
    // DEFAULT_TEST_TIMEOUT = 5min), so a WS client MUST pass an options.timeout
    // >= that inner budget plus setup/teardown margin (e.g. 6min for test).
    // Otherwise the outer action times out; the emitter now surfaces that as a
    // thrown ActionTimeoutError (strict mode) rather than silently resolving
    // empty, while this handler's ctx.reply is dropped. The handler cannot
    // widen the caller's window. Enforced by the #300 client. (See AC9.)
    this.emitter.onAction('core.workflow.lint', async (input, ctx) => {
      this.#assertValidWorkflowInput(
        'core.workflow.lint',
        workflowLintActionSchema,
        input,
      );
      ctx.reply(await this.lint(input));
    });
    this.emitter.onAction('core.workflow.test', async (input, ctx) => {
      this.#assertValidWorkflowInput(
        'core.workflow.test',
        workflowTestActionSchema,
        input,
      );
      ctx.reply(await this.test(input));
    });
    this.emitter.onAction('core.workflow.analyze', async (input, ctx) => {
      this.#assertValidWorkflowInput(
        'core.workflow.analyze',
        workflowAnalyzeActionSchema,
        input,
      );
      ctx.reply(await this.analyze(input));
    });
  }

  // Validate a workflow action payload, throwing InvalidActionInputError with
  // the AJV failure detail on rejection. The detail is placed in the message
  // (not just `suggestions`) because the WS proxy serializes errors down to
  // { name, message } — so the message is the only channel that reaches the
  // #300 WS client. `validate()` populates `ajv.errors` synchronously on the
  // shared instance, so it is read immediately after the failed call. We route
  // through `formatAjvErrors` (rather than raw `errorsText`) so the message
  // matches the human-readable phrasing used by the other validation paths.
  #assertValidWorkflowInput<T>(
    actionName: string,
    schema: JSONSchemaType<T>,
    input: unknown,
  ): asserts input is T {
    if (!validate(schema, input)) {
      const { message } = formatAjvErrors(ajv.errors);
      throw new ThymianBaseError(`Invalid ${actionName} input: ${message}.`, {
        name: 'InvalidActionInputError',
        ref: 'https://thymian.dev/references/errors/invalid-action-input-error/',
        suggestions: [message],
      });
    }
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
        const { message } = formatAjvErrors(ajv.errors);
        throw new PluginRegistrationError(
          `Invalid options for plugin "${plugin.name}": ${message}`,
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

      const errorSubscription = this.emitter.onError((event) => {
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
        })
        .finally(() => {
          errorSubscription.unsubscribe();
        });
    });
  }

  async close(): Promise<void> {
    // Shutdown is best-effort: a plugin whose core.close handler stalls must not
    // turn teardown into a thrown ActionTimeoutError. strict:false keeps the
    // emitter's silent-empty behavior for this action only.
    await this.emitter.emitAction('core.close', undefined, { strict: false });

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
  async lint(input: LintWorkflowInput): Promise<Report> {
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
      loadRules(
        input.rules ?? [],
        ruleFilter,
        rulesConfig,
        this.options.cwd,
        input.ruleProfiles,
      ),
    ]);

    this.logger.info(
      `Loaded ${rules.length} rule(s). Running lint workflow...`,
    );

    const toolRuns = (
      await this.emitter.emitAction(
        'core.lint',
        { format: format.export(), rules, rulesConfig, options: input.options },
        { strategy: 'collect' },
      )
    ).flat();

    return this.finalizeWorkflow(toolRuns, format.export());
  }

  async test(input: TestWorkflowInput): Promise<Report> {
    const { rulesConfig, ruleFilter } = input;

    const [format, rules] = await Promise.all([
      this.loadFormat({
        inputs: input.specification,
        validateSpecs: input.validateSpecs ?? false,
      }),
      loadRules(
        input.rules ?? [],
        ruleFilter,
        rulesConfig,
        this.options.cwd,
        input.ruleProfiles,
      ),
    ]);

    const toolRuns = (
      await this.emitter.emitAction(
        'core.test',
        {
          format: format.export(),
          rules,
          rulesConfig,
          options: input.options,
          targetUrl: input.targetUrl,
        },
        { strategy: 'collect', timeout: Thymian.DEFAULT_TEST_TIMEOUT },
      )
    ).flat();

    return this.finalizeWorkflow(toolRuns, format.export());
  }

  async analyze(input: AnalyzeWorkflowInput): Promise<Report> {
    const { rulesConfig, ruleFilter } = input;

    const [traffic, rules, format] = await Promise.all([
      this.loadTraffic({
        inputs: input.traffic,
        validateTrafficSource: input.validateTrafficSource ?? false,
      }),
      loadRules(
        input.rules ?? [],
        ruleFilter,
        rulesConfig,
        this.options.cwd,
        input.ruleProfiles,
      ),
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

    const toolRuns = (
      await this.emitter.emitAction(
        'core.analyze',
        {
          traffic,
          format: format?.export(),
          rules,
          rulesConfig,
          options: input.options,
        } satisfies CoreAnalyzeInput,
        { strategy: 'collect' },
      )
    ).flat();

    return this.finalizeWorkflow(toolRuns, format?.export());
  }

  /**
   * Core-owned `report convert` collect action (ADR-0016): broadcasts typed
   * report inputs to plugin listeners, which claim the input types they
   * understand and reply {@link ConvertedRunFragment}s. Type resolution stays
   * plugin-claimed (ADR-0017) — an input with no matching reply is returned in
   * `unclaimed`, never thrown; enforcement is the caller's job.
   *
   * Report inputs are treated as a set: duplicates (same `type` and
   * stringified `location`) are collapsed to their first occurrence before
   * dispatch, so one claimed input yields its converted run(s) exactly once.
   * Assembled runs are additionally de-duplicated on `runId` — the same
   * persisted run arriving under two different paths contributes once.
   */
  async reportConvert(
    input: ReportConvertWorkflowInput,
  ): Promise<ReportConvertOutcome> {
    const seenInputs = new Set<string>();
    const reports = input.reports.filter((reportInput) => {
      const key = `${reportInput.type}:${String(reportInput.location)}`;

      if (seenInputs.has(key)) {
        return false;
      }

      seenInputs.add(key);
      return true;
    });

    const format = input.specification?.length
      ? await this.loadFormat(
          {
            inputs: input.specification,
            validateSpecs: input.validateSpecs ?? false,
          },
          { emitFormat: false },
        )
      : undefined;

    const fragments: ConvertedRunFragment[] = (
      await this.emitter.emitAction(
        'core.report.convert',
        {
          inputs: reports,
          format: format?.export(),
          options: input.options,
        },
        { strategy: 'collect' },
      )
    ).flat();

    const fragmentsByKey = new Map<string, ConvertedRunFragment[]>();
    for (const fragment of fragments) {
      const key = `${fragment.input.type}:${fragment.input.location}`;
      const bucket = fragmentsByKey.get(key);

      if (bucket) {
        bucket.push(fragment);
      } else {
        fragmentsByKey.set(key, [fragment]);
      }
    }

    const unclaimed: ReportInput[] = [];
    // Union of fragment-carried format maps (#507): first occurrence wins per
    // hash — equal hashes mean equal serialized graphs, so collisions are
    // benign. Collected in assembly (input) order alongside the runs.
    // Null-prototype object: persisted files are external input, so a hash
    // key like 'constructor' or '__proto__' must behave as plain data.
    const fragmentFormats: NonNullable<Report['thymianFormat']> = Object.create(
      null,
    ) as NonNullable<Report['thymianFormat']>;

    const toolRuns = reports.flatMap((reportInput) => {
      const key = `${reportInput.type}:${String(reportInput.location)}`;
      const matches = fragmentsByKey.get(key);

      if (!matches) {
        unclaimed.push(reportInput);
        return [];
      }

      fragmentsByKey.delete(key);
      return matches.map((fragment) => {
        const fragmentHashes: string[] = [];

        if (fragment.thymianFormat) {
          for (const [hash, serialized] of Object.entries(
            fragment.thymianFormat,
          )) {
            // Skip junk values (e.g. null or [] from a hand-edited persisted
            // map — arrays are typeof 'object' too) rather than copying them
            // into the merged report.
            if (
              !serialized ||
              typeof serialized !== 'object' ||
              Array.isArray(serialized)
            ) {
              continue;
            }

            fragmentHashes.push(hash);
            if (!Object.hasOwn(fragmentFormats, hash)) {
              fragmentFormats[hash] = serialized;
            }
          }
        }

        // Provenance-safe version completion: this fragment's own map is the
        // only format its run can have used, so a single-entry map pins a
        // missing `thymianFormatVersion` here — the render-side sole-entry
        // fallback is gone (it read the cross-input union, which could
        // attribute a foreign format to the run).
        if (
          fragment.run.thymianFormatVersion === undefined &&
          fragmentHashes.length === 1
        ) {
          return { ...fragment.run, thymianFormatVersion: fragmentHashes[0] };
        }

        return fragment.run;
      });
    });

    // Run identity is `runId`, not the input path it arrived under: the same
    // persisted run reaching the merge twice (a copied file, two exports of
    // one report) must not yield duplicate `runId`s in the assembled report —
    // downstream consumers join and de-duplicate on that id.
    const seenRunIds = new Set<string>();
    const uniqueToolRuns = toolRuns.filter((run) => {
      if (seenRunIds.has(run.runId)) {
        return false;
      }

      seenRunIds.add(run.runId);
      return true;
    });

    if (uniqueToolRuns.length < toolRuns.length) {
      this.logger.warn(
        `Dropped ${toolRuns.length - uniqueToolRuns.length} run(s) with duplicate runId(s) — the same run arrived from more than one input; the first occurrence is kept.`,
      );
    }

    const surplus = [...fragmentsByKey.values()].flat();

    if (surplus.length > 0) {
      this.logger.warn(
        `Discarding ${surplus.length} converted run fragment(s) claiming input(s) not part of this request: ${surplus
          .map(
            (fragment) => `${fragment.input.type}:${fragment.input.location}`,
          )
          .join(', ')}`,
      );
    }

    // The workflow-level spec (--spec) joins the merged map only when a run
    // actually converted against it — otherwise the output would carry a
    // serialized graph no run points at.
    const workflowFormat = format?.export();
    const workflowFormatUsed =
      workflowFormat !== undefined &&
      uniqueToolRuns.some(
        (run) => run.thymianFormatVersion === workflowFormat.attributes.hash,
      );

    return {
      report: this.finalizeWorkflow(
        uniqueToolRuns,
        workflowFormatUsed ? workflowFormat : undefined,
        Object.keys(fragmentFormats).length > 0 ? fragmentFormats : undefined,
        // Unclaimed inputs are a usage error the caller enforces (ADR-0017);
        // a partial assembly must not reach `core.report` listeners, or the
        // file formatters would persist a truncated merge before the caller
        // gets to fail the command.
        { emitReport: unclaimed.length === 0 },
      ),
      unclaimed,
    };
  }

  async validate(input: ValidateWorkflowInput): Promise<SpecValidationOutcome> {
    this.logger.info(
      `Validating ${input.specification.length} specification(s)...`,
    );

    const results = (
      await this.emitter.emitAction(
        'core.validate-specs',
        {
          inputs: input.specification,
        },
        { strategy: 'collect' },
      )
    ).flat();

    const completedResults = [...results];

    for (const specification of input.specification) {
      const hasResult = results.some(
        (result) =>
          result.type === specification.type &&
          result.location === String(specification.location),
      );

      if (!hasResult) {
        completedResults.push({
          type: specification.type,
          location: String(specification.location),
          source: String(specification.location),
          status: 'unsupported',
          issues: [
            {
              message: `No validator registered for specification type "${specification.type}".`,
            },
          ],
        });
      }
    }

    const classification = this.classifySpecValidationResults(completedResults);

    this.logger.info(`Validation complete: ${classification}.`);

    return {
      classification,
      results: completedResults,
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

  private finalizeWorkflow(
    toolRuns: ToolRun[],
    format?: ReturnType<ThymianFormat['export']>,
    additionalFormats?: Report['thymianFormat'],
    options: { emitReport?: boolean } = {},
  ): Report {
    let thymianFormat: Report['thymianFormat'];

    if (format || additionalFormats) {
      // `report.thymianFormat` is a public shape (plugins on `core.report`,
      // custom formatters, strict test equality), so it stays an ordinary
      // plain-prototype object. Hash keys from persisted inputs are external
      // data, though: they are defined as own data properties so a key like
      // '__proto__' lands as plain data instead of hitting the prototype
      // setter (the fragment union in `reportConvert` accumulates on a
      // null-prototype object for the same reason).
      const copied: NonNullable<Report['thymianFormat']> = {};
      for (const [hash, serialized] of Object.entries(
        additionalFormats ?? {},
      )) {
        Object.defineProperty(copied, hash, {
          value: serialized,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      thymianFormat = copied;

      // Keep an already-present entry (same hash ⇒ same graph). Own-key
      // check and defineProperty like the copies above: a plain `??=` would
      // read inherited members (`constructor`) and write through the
      // `__proto__` setter if a hash ever collided with them.
      if (format && !Object.hasOwn(thymianFormat, format.attributes.hash)) {
        Object.defineProperty(thymianFormat, format.attributes.hash, {
          value: format,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }

    // Single-workflow provenance: without `additionalFormats`, every run in
    // this workflow ran against the one `format` loaded for it, so a producer
    // that forgot to set `thymianFormatVersion` is completed here. (Replaces
    // the render-side sole-entry fallback, which became unsafe once merged
    // reports can union formats from several sources.)
    const runs =
      format && !additionalFormats
        ? toolRuns.map((run) =>
            run.thymianFormatVersion === undefined
              ? { ...run, thymianFormatVersion: format.attributes.hash }
              : run,
          )
        : toolRuns;

    const report = createReport(runs, thymianFormat);

    if (options.emitReport ?? true) {
      this.emitter.emit('core.report', report);
    }

    this.logger.info('Workflow complete.');

    return report;
  }

  private classifySpecValidationResults(
    results: SpecValidationResult[],
  ): SpecValidationOutcome['classification'] {
    if (
      results.some(
        (result) =>
          result.status === 'error' || result.status === 'unsupported',
      )
    ) {
      return 'tool-error';
    }

    if (results.some((result) => result.status === 'failed')) {
      return 'findings';
    }

    return 'clean-run';
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
