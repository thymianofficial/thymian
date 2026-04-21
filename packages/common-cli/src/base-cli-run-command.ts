import { createRequire } from 'node:module';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

import { Command, Flags, Interfaces, settings, ux } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import {
  isLogLevel,
  isPlugin,
  type Logger,
  type LogLevel,
  type SpecificationInput,
  TextLogger,
  Thymian,
  ThymianBaseError,
  type ThymianPlugin,
  type TrafficInput,
} from '@thymian/core';

import { ErrorCache } from './error-cache.js';
import { Feedback } from './feedback.js';
import { deepSet, optionFlag } from './flags/option-flag.js';
import { ruleSetFlag } from './flags/rule-set-flag.js';
import { specFlag } from './flags/spec-flag.js';
import { trafficFlag } from './flags/traffic-flag.js';
import { getConfig } from './get-config.js';
import type { ThymianSpecSearchResult } from './hooks/spec-search-hook.js';
import type { ThymianTrafficSearchResult } from './hooks/traffic-search-hook.js';
import type { ThymianConfig } from './thymian-config.js';

const require = createRequire(import.meta.url);

export type CommandFlags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCliRunCommand)['baseFlags'] & T['flags']
>;
export type CommandArgs<T extends typeof Command> = Interfaces.InferredArgs<
  T['args']
>;

export abstract class BaseCliRunCommand<
  T extends typeof Command,
> extends Command {
  static override enableJsonFlag = false;

  /**
   * Whether this command requires API specifications to run.
   * Commands that operate independently of specs (e.g. `serve`, `http-linter:overview`)
   * can set this to `false` to skip the spec resolution chain (Steps C–F).
   */
  static requiresSpecifications = true;

  /**
   * Whether this command requires traffic inputs to run.
   * Only `analyze` sets this to `true`. When enabled, traffic is resolved
   * via --traffic flag → config → thymian.traffic-search hook → guidance.
   */
  static requiresTraffic = false;

  static override baseFlags = {
    verbose: Flags.boolean({
      default: false,
      description: 'Run thymian in verbose mode.',
      helpGroup: 'BASE',
    }),
    debug: Flags.boolean({
      default: false,
      charAliases: ['d'],
      description: 'Run thymian in debug mode.',
      helpGroup: 'BASE',
    }),
    guidance: Flags.boolean({
      allowNo: true,
      description:
        'Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.',
      helpGroup: 'BASE',
    }),
    ['sort-reports-by']: Flags.string({
      description: 'Control how validation findings are grouped in the report.',
      helpGroup: 'BASE',
      options: ['rule', 'endpoint', 'severity'],
      default: 'endpoint',
    }),
    ['log-level']: Flags.string({
      description:
        'Set log level (trace, debug, info, warn, error, silent). When set to trace, all events are traced.',
      helpGroup: 'BASE',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
    }),
    config: Flags.file({
      aliases: ['c'],
      charAliases: ['c'],
      description: 'Path to thymian configuration file.',
      helpGroup: 'BASE',
    }),
    autoload: Flags.boolean({
      allowNo: true,
      description:
        'Automatically load and initialize plugins from the configuration file.',
      helpGroup: 'BASE',
    }),
    plugin: Flags.string({
      multiple: true,
      charAliases: ['p'],
      default: [],
      description:
        'Load an additional plugin package or relative plugin path before running the command. Can be used multiple times.',
      helpGroup: 'BASE',
    }),
    option: optionFlag(),
    spec: specFlag(),
    traffic: trafficFlag(),
    ['rule-set']: ruleSetFlag(),
    ['rule-severity']: Flags.string({
      description:
        'Set the minimum rule severity threshold for rule loading (off, error, warn, hint). Only rules at or above this severity are loaded.',
      helpGroup: 'BASE',
      options: ['off', 'error', 'warn', 'hint'],
    }),
    timeout: Flags.integer({
      default: Thymian.DEFAULT_TIMEOUT,
      charAliases: ['t'],
      description:
        'Set the duration in ms to wait for anything that happens in Thymian.',
      helpGroup: 'BASE',
    }),
    ['idle-timeout']: Flags.integer({
      description:
        'Set the duration in ms to waited for events and actions when closing Thymian.',
      helpGroup: 'BASE',
      default: Thymian.DEFAULT_IDLE_TIMEOUT,
    }),
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
    ['suppress-feedback']: Flags.boolean({
      default: false,
      description: 'Suppress feedback messages from Thymian.',
      helpGroup: 'BASE',
    }),
    ['validate-specs']: Flags.boolean({
      default: false,
      allowNo: true,
      description:
        'Validate included specifications and fail on schema validation errors.',
      helpGroup: 'BASE',
    }),
  };

  protected flags!: CommandFlags<T>;
  protected args!: CommandArgs<T>;
  protected logger!: Logger;
  protected thymianConfig!: ThymianConfig;
  protected thymian!: Thymian;
  protected feedback?: Feedback;
  protected errorCache?: ErrorCache;

  /**
   * Whether guidance output is enabled for this command run.
   * Resolved from `--guidance`/`--no-guidance` flag with TTY auto-detection fallback.
   */
  protected guidanceEnabled = false;

  public override async init(): Promise<void> {
    await super.init();

    this.errorCache = ErrorCache.forCommand(this);

    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCliRunCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as CommandFlags<T>;
    this.args = args as CommandArgs<T>;
    this.flags.debug = settings.debug || this.flags.debug;

    this.guidanceEnabled = this.flags.guidance ?? Boolean(process.stderr.isTTY);

    this.feedback = Feedback.forCommand(this);

    // --- Config Resolution Chain ---
    // Step A+B: Load config from --config flag, well-known file, or defaultConfig
    this.thymianConfig = await getConfig({
      configPath: this.flags.config,
      cwd: this.flags.cwd,
    });

    this.overridePluginOptions();

    // Step C: --spec flag overrides config specifications
    if (this.flags.spec && this.flags.spec.length > 0) {
      this.thymianConfig = {
        ...this.thymianConfig,
        specifications: this.flags.spec,
      };
    }

    // Step D+E+F: If no specifications at this point, ask plugins to search
    // Only enforced for commands that require specifications.
    const requiresSpecs = (this.ctor as typeof BaseCliRunCommand)
      .requiresSpecifications;

    if (
      requiresSpecs &&
      (!this.thymianConfig.specifications ||
        this.thymianConfig.specifications.length === 0)
    ) {
      const discovered = await this.runSpecSearch();

      if (discovered.length > 0) {
        // Step E: Specifications found — suggest user actions and exit
        const fileList = discovered
          .flatMap((d) => d.specifications.map((s) => `  - ${s.location}`))
          .join('\n');
        const firstSpec = discovered[0]!.specifications[0]!;

        ux.stderr(
          `No specification configured. The following specification files were detected:\n\n${fileList}\n`,
        );
        ux.stderr('Rerun with --spec to use a detected file, for example:\n');
        ux.stderr(
          `  $ thymian ${this.id} --spec ${formatSpecInput(firstSpec)}\n`,
        );
        ux.stderr('Or generate a reusable config:\n');
        ux.stderr(
          `  $ thymian generate config --for-spec ${formatSpecInput(firstSpec)}\n`,
        );
        this.exit(2);
      } else {
        // Step F: No specifications found anywhere
        ux.stderr(
          'No specification found. Provide a specification with --spec or create a configuration file.\n',
        );
        ux.stderr('  $ thymian generate config\n');
        this.exit(2);
      }
    }

    // --- Traffic Resolution Chain ---
    // --traffic flag overrides config traffic
    if (this.flags.traffic && this.flags.traffic.length > 0) {
      this.thymianConfig = {
        ...this.thymianConfig,
        traffic: this.flags.traffic,
      };
    }

    const requiresTraffic = (this.ctor as typeof BaseCliRunCommand)
      .requiresTraffic;

    if (
      requiresTraffic &&
      (!this.thymianConfig.traffic || this.thymianConfig.traffic.length === 0)
    ) {
      const discovered = await this.runTrafficSearch();

      if (discovered.length > 0) {
        const fileList = discovered
          .flatMap((d) => d.traffic.map((t) => `  * ${formatTrafficInput(t)}`))
          .join('\n');
        const firstTraffic = discovered[0]!.traffic[0]!;

        ux.stderr(
          `No traffic configured. The following traffic files were detected:\n\n${fileList}\n`,
        );
        ux.stderr(
          'Rerun with --traffic to use a detected file, for example:\n',
        );
        ux.stderr(
          `  $ thymian ${this.id} --traffic ${formatTrafficInput(firstTraffic)}\n`,
        );
        this.exit(2);
      } else {
        ux.stderr(
          'No traffic found. Provide traffic with --traffic or add it to your configuration file.\n',
        );
        this.exit(2);
      }
    }

    const logLevel = this.resolveLogLevelWithConfig();

    this.logger = new TextLogger('thymian', logLevel);

    this.logger.info('Configuration loaded.');

    const specCount = this.thymianConfig.specifications?.length ?? 0;
    if (specCount > 0) {
      this.logger.info(`Resolved ${specCount} specification(s).`);
    }

    this.thymian = new Thymian(this.logger.child('@thymian/core'), {
      timeout: this.flags.timeout,
      cwd: this.flags.cwd,
      idleTimeout: this.flags['idle-timeout'],
      sortReportsBy: this.flags['sort-reports-by'] as
        | 'rule'
        | 'endpoint'
        | 'severity',
    });

    this.logger.info('Thymian instance created.');

    if (this.shouldAutoload()) {
      this.debug('Autoloading Thymian plugins.');
      this.logger.info('Autoloading plugins from configuration...');
      await this.addPluginsToThymianConfig();
      await this.registerPluginsFromConfig();
    }

    await this.feedback?.run();
  }

  protected override async catch(err: CommandError): Promise<void> {
    await this.feedback?.error();
    const versionDetails = this.config.versionDetails;

    const pluginVersions = Object.entries(versionDetails.pluginVersions ?? {})
      .filter(([name]) => !name.startsWith('@oclif'))
      .map(([name, version]) => ({ name, version: version.version }));

    await this.errorCache?.write({
      name: err.name,
      message: err.message,
      commandName: this.id ?? 'unknown command',
      timestamp: Date.now(),
      cause: err.cause,
      stack: err.stack,
      argv: process.argv,
      version: {
        architecture: versionDetails.architecture,
        cliVersion: versionDetails.cliVersion,
        nodeVersion: versionDetails.nodeVersion,
        osVersion: versionDetails.osVersion,
      },
      pluginVersions,
    });

    if (err instanceof ThymianBaseError) {
      const cliError = new CLIError(err.message, {
        suggestions: err.options.suggestions,
        exit: err.options.exitCode,
        code: err.options.code,
      });

      cliError.name = err.name;
      Object.defineProperty(cliError, 'ref', { value: err.options.ref });

      if (settings.debug) {
        this.printStackTraces(err);
      }

      return super.catch(cliError);
    }

    return super.catch(err);
  }

  protected printStackTraces(err: unknown): void {
    if (err instanceof Error) {
      if (this.jsonEnabled() && err.cause) {
        this.logJson(this.toErrorJson(err.cause));
      } else if (err.cause) {
        ux.stderr(
          err.cause instanceof Error
            ? String(err.cause)
            : inspect(err.cause, { depth: 3 }),
        );
      }
      this.printStackTraces(err.cause);
    }
  }

  protected shouldAutoload(): boolean {
    if ('autoload' in this.flags) {
      return this.flags.autoload;
    }

    return this.thymianConfig.autoload ?? true;
  }

  /**
   * Run the `thymian.spec-search` oclif hook to let plugins discover specification files.
   * Returns results grouped by plugin, each containing typed SpecificationInput[].
   */
  private async runSpecSearch(): Promise<ThymianSpecSearchResult[]> {
    const hookResults = await this.config.runHook('thymian.spec-search', {
      cwd: this.flags.cwd,
    });

    const results: ThymianSpecSearchResult[] = [];
    for (const success of hookResults.successes) {
      const result = success.result as ThymianSpecSearchResult;
      if (result.specifications.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Run the `thymian.traffic-search` oclif hook to let plugins discover traffic files.
   * Returns results grouped by plugin, each containing typed TrafficInput[].
   */
  private async runTrafficSearch(): Promise<ThymianTrafficSearchResult[]> {
    const hookResults = await this.config.runHook('thymian.traffic-search', {
      cwd: this.flags.cwd,
    });

    const results: ThymianTrafficSearchResult[] = [];
    for (const success of hookResults.successes) {
      const result = success.result as ThymianTrafficSearchResult;
      if (result.traffic.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Apply `-o` flag overrides to the loaded Thymian configuration.
   *
   * Each override targets a specific plugin by name and sets a deeply
   * nested property on its `options` object.  If the plugin entry does
   * not yet exist in the config it will be created.
   */
  protected overridePluginOptions(): void {
    if (!this.flags.option?.length) {
      return;
    }

    for (const override of this.flags.option) {
      this.thymianConfig.plugins[override.pluginName] ??= {};
      const pluginConfig = this.thymianConfig.plugins[override.pluginName]!;
      pluginConfig.options ??= {};
      deepSet(
        pluginConfig.options as Record<string, unknown>,
        override.path,
        override.value,
      );
    }
  }

  /**
   * Re-resolve log level considering the config file.
   * Only applies config.logLevel if no explicit flag was set.
   */
  private resolveLogLevelWithConfig(): LogLevel {
    const flagLevel = this.flags['log-level'];

    if (flagLevel && isLogLevel(flagLevel)) {
      return flagLevel;
    }

    if (this.flags.debug) {
      return 'debug';
    }

    if (this.flags.verbose) {
      return 'info';
    }

    if (
      this.thymianConfig.logLevel &&
      isLogLevel(this.thymianConfig.logLevel)
    ) {
      return this.thymianConfig.logLevel;
    }

    return 'warn';
  }

  public setThymian(thymian: Thymian): void {
    this.thymian = thymian;
  }

  protected async loadPluginModule(
    nameOrPath: string,
    isRelativePath = false,
  ): Promise<ThymianPlugin> {
    const options = this.thymianConfig.plugins[nameOrPath] ?? {};
    const location =
      isRelativePath || typeof options.path === 'string'
        ? resolve(this.flags.cwd, options.path ?? nameOrPath)
        : nameOrPath;

    let pluginModule;

    this.debug('Load plugin module from location "%s".', location);

    try {
      const resolvedPath = require.resolve(location);
      pluginModule = (await import(pathToFileURL(resolvedPath).href)).default;
    } catch (e) {
      this.logger.debug(
        'Failed to load plugin module from "%s": %s',
        location,
        inspect(e),
      );
      throw new ThymianBaseError(
        `Failed to load plugin module "${options.path ?? nameOrPath}".`,
        {
          name: 'PluginLoadError',
          cause: e,
        },
      );
    }

    if (!isPlugin(pluginModule)) {
      throw new CLIError(
        `"${
          options.path ?? nameOrPath
        }" does not default export a valid Thymian plugin.`,
      );
    }

    return pluginModule;
  }

  protected async registerPlugin(
    nameOrPath: string,
    isRelativePath = false,
  ): Promise<void> {
    const pluginModule = await this.loadPluginModule(
      nameOrPath,
      isRelativePath,
    );

    const config = this.thymianConfig.plugins[pluginModule.name] ?? {};

    if (typeof config.autoload === 'boolean' && !config.autoload) {
      return;
    }

    this.thymian.register(pluginModule, config.options);
  }

  protected async addPluginsToThymianConfig(): Promise<void> {
    for (const plugin of this.flags.plugin) {
      this.debug('Adding plugin from flag "%s" to Thymian config.', plugin);

      const isPathPlugin =
        isAbsolute(plugin) ||
        plugin.startsWith('./') ||
        plugin.startsWith('../');

      if (!isPathPlugin) {
        this.debug('Load plugin "%s" as npm package or absolute path.', plugin);

        const pluginModule = await this.loadPluginModule(plugin, false);

        this.thymianConfig.plugins[pluginModule.name] ??= {};
      } else {
        this.debug(`Load plugin %s from relative path.`, plugin);

        const pluginModule = await this.loadPluginModule(plugin, true);

        this.thymianConfig.plugins[pluginModule.name] = {
          ...(this.thymianConfig.plugins[pluginModule.name] ?? {}),
          path: plugin,
        };
      }
    }
  }

  protected async registerPluginsFromConfig(): Promise<void> {
    for (const name of Object.keys(this.thymianConfig.plugins)) {
      await this.registerPlugin(name);
    }
  }

  public shouldSuppressFeedback(): boolean {
    return this.flags['suppress-feedback'];
  }

  /**
   * Write a guidance message to stderr when guidance is enabled.
   * This is the single choke-point for all guidance output — if
   * `this.guidanceEnabled` is false, the method is a no-op.
   */
  public guidance(message: string): void {
    if (!this.guidanceEnabled) {
      return;
    }

    ux.stderr(message);
  }
}

/**
 * Format a SpecificationInput as `type:location` for display and --spec flag suggestions.
 */
function formatSpecInput(spec: SpecificationInput): string {
  return `${spec.type}:${spec.location}`;
}

/**
 * Format a TrafficInput as `type:location` for display and --traffic flag suggestions.
 */
function formatTrafficInput(traffic: TrafficInput): string {
  return `${traffic.type}:${traffic.location}`;
}
