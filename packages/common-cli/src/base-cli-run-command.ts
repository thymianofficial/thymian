import { isAbsolute } from 'node:path';
import { inspect } from 'node:util';

import { Command, Flags, Interfaces, settings, ux } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import {
  isLogLevel,
  isPlugin,
  isRecord,
  type Logger,
  type LogLevel,
  SORT_REPORTS_BY_VALUES,
  type SortReportsBy,
  type SpecificationInput,
  TextLogger,
  Thymian,
  ThymianBaseError,
  type ThymianPlugin,
  type TrafficInput,
} from '@thymian/core';
import { loadUserModule, resolveUserModule } from '@thymian/core/user-module';

import { applyReporterSortReportsBy } from './apply-plugin-options.js';
import { describePluginLoadFailure } from './describe-plugin-load-failure.js';
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

const PLUGIN_LOAD_ERROR_REF =
  'https://thymian.dev/references/errors/plugin-load-error/';

// Single source for the export-mechanism suggestion (used only where the
// module loaded but exposes no usable default export).
const EXPORT_DEFAULT_SUGGESTION =
  'Use "export default" or "module.exports =" to export your plugin.';

const LOADABLE_EXTENSION = /\.(ts|js|mjs|cjs)$/;

/**
 * A specifier that explicitly names a local file by relative path — the four
 * prefixes Node/jiti resolve relative to the importing file, in both POSIX
 * (`./`, `../`) and Windows (`.\`, `..\`) spellings. Kept in one place so the
 * plugin classifier and the suggestion helper agree on what counts as local;
 * without it a `.\`-prefixed `--plugin` is misfiled as a package and its `path`
 * never persisted to the config. (epic #725 §4.1.)
 */
function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('.\\') ||
    specifier.startsWith('..\\')
  );
}

/**
 * When a *bare* specifier that looks like a file path (has a loadable
 * extension, no `./`/`../`/`.\`/`..\` prefix, not absolute) fails to resolve
 * as an installed package, the user most likely meant a local file. Offer the
 * relative-path spelling — a bare specifier is never resolved cwd-relative
 * (epic #725 §4.1, no `<cwd>/<specifier>` fallback). Returns undefined when no
 * hint applies.
 */
function suggestLocalPathSpelling(specifier: string): string | undefined {
  const looksLocal = isRelativeSpecifier(specifier) || isAbsolute(specifier);

  if (looksLocal || !LOADABLE_EXTENSION.test(specifier)) {
    return undefined;
  }

  return `If "${specifier}" is a local file, reference it with a relative path and explicit extension: "./${specifier}".`;
}

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
    spec: specFlag({
      helpGroup: 'BASE',
    }),
    traffic: trafficFlag(),
    ['rule-set']: ruleSetFlag(),
    ['rule-severity']: Flags.string({
      description:
        'Set the minimum rule severity threshold for rule loading (off, error, warn, hint). Only rules at or above this severity are loaded.',
      helpGroup: 'BASE',
      options: ['off', 'error', 'warn', 'hint'],
    }),
    ['sort-reports-by']: Flags.custom<SortReportsBy>({
      description:
        'Group report findings by rule, endpoint, or severity (default: endpoint). Affects the CLI report and any configured reporter that supports grouping.',
      helpGroup: 'BASE',
      options: [...SORT_REPORTS_BY_VALUES],
    })(),
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
    });

    this.logger.info('Thymian instance created.');

    if (this.shouldAutoload()) {
      this.debug('Autoloading Thymian plugins.');
      this.logger.info('Autoloading plugins from configuration...');
      await this.addPluginsToThymianConfig();
      this.applyOptionsToPlugins();
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
        exit: 2,
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
   * Maps CLI flags onto plugin options before plugins are registered — the one
   * place where a flag is wired to a specific plugin's config. Add future
   * flag→plugin mappings here. The mapping logic lives in
   * `apply-plugin-options.ts` so it can be unit-tested without a command.
   *
   * Currently: `--sort-reports-by` is forwarded to the reporter plugin (see
   * `applyReporterSortReportsBy` for the flag-wins precedence over `-o`/config
   * and the never-auto-register guard). The terminal renderer receives the flag
   * via a separate channel (`handleWorkflowOutcome`).
   */
  protected applyOptionsToPlugins(): void {
    applyReporterSortReportsBy(
      this.thymianConfig,
      this.flags['sort-reports-by'],
    );
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

  protected async loadPluginModule(nameOrPath: string): Promise<ThymianPlugin> {
    const options = this.thymianConfig.plugins[nameOrPath] ?? {};
    const specifier = options.path ?? nameOrPath;

    this.debug('Load plugin module from specifier "%s".', specifier);

    const resolution = resolveUserModule(specifier, { cwd: this.flags.cwd });

    if (!resolution.ok) {
      // Resolution FAILURE: the path resolved cleanly but was refused for what
      // it is — the seam's `reason` is rendered verbatim (§6).
      if (resolution.reason) {
        throw new ThymianBaseError(
          `Cannot load plugin "${specifier}": ${resolution.reason.replace(/\.$/, '')}.`,
          {
            name: 'PluginLoadError',
            suggestions: [
              'Reference a built .js/.mjs/.cjs file or a local .ts file with an explicit extension. Installed packages must ship built JavaScript.',
            ],
            ref: PLUGIN_LOAD_ERROR_REF,
          },
        );
      }

      // Resolution NOT-FOUND: no `reason` — the caller phrases it. Offer the
      // relative-path spelling when a bare, path-like specifier probably meant
      // a local file (§4.1 has no cwd-relative fallback).
      const suggestions = [
        'For a local plugin, use a relative path with an explicit extension (e.g. ./my-plugin.ts). For an installed package, check that it is installed.',
      ];
      const localHint = suggestLocalPathSpelling(specifier);

      if (localHint) {
        suggestions.unshift(localHint);
      }

      throw new ThymianBaseError(`Cannot resolve plugin "${specifier}".`, {
        name: 'PluginLoadError',
        suggestions,
        ref: PLUGIN_LOAD_ERROR_REF,
      });
    }

    let rawModule: unknown;

    try {
      rawModule = await loadUserModule(resolution.path);
    } catch (e) {
      this.logger.debug(
        'Failed to load plugin module from "%s": %s',
        resolution.path,
        inspect(e),
      );

      const { reason, suggestions } = describePluginLoadFailure(e);

      throw new ThymianBaseError(
        `Cannot load plugin "${specifier}": ${reason}`,
        {
          name: 'PluginLoadError',
          suggestions,
          ref: PLUGIN_LOAD_ERROR_REF,
          cause: e,
        },
      );
    }

    const module = isRecord(rawModule) ? rawModule : {};

    if (!('default' in module)) {
      throw new ThymianBaseError(
        `Plugin "${specifier}" does not use a default export.`,
        {
          name: 'PluginLoadError',
          suggestions: [EXPORT_DEFAULT_SUGGESTION],
          ref: PLUGIN_LOAD_ERROR_REF,
        },
      );
    }

    const pluginModule = module.default;

    if (!isPlugin(pluginModule)) {
      throw new ThymianBaseError(
        `"${specifier}" does not default export a valid Thymian plugin.`,
        {
          name: 'PluginLoadError',
          suggestions: [
            'The default export must be a Thymian plugin object with a "plugin" function, a "name" string, and a "version" string.',
          ],
          ref: PLUGIN_LOAD_ERROR_REF,
        },
      );
    }

    return pluginModule;
  }

  protected async registerPlugin(nameOrPath: string): Promise<void> {
    const pluginModule = await this.loadPluginModule(nameOrPath);

    const config = this.thymianConfig.plugins[pluginModule.name] ?? {};

    if (typeof config.autoload === 'boolean' && !config.autoload) {
      return;
    }

    this.thymian.register(pluginModule, config.options);
  }

  protected async addPluginsToThymianConfig(): Promise<void> {
    for (const plugin of this.flags.plugin) {
      this.debug('Adding plugin from flag "%s" to Thymian config.', plugin);

      const isPathPlugin = isAbsolute(plugin) || isRelativeSpecifier(plugin);

      if (!isPathPlugin) {
        this.debug('Load plugin "%s" as npm package or absolute path.', plugin);

        const pluginModule = await this.loadPluginModule(plugin);

        this.thymianConfig.plugins[pluginModule.name] ??= {};
      } else {
        this.debug(`Load plugin %s from relative path.`, plugin);

        const pluginModule = await this.loadPluginModule(plugin);

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
