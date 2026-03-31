import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';

import { Command, Flags, Interfaces, settings } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import {
  isLogLevel,
  isPlugin,
  type Logger,
  type LogLevel,
  TextLogger,
  Thymian,
  ThymianBaseError,
  type ThymianPlugin,
} from '@thymian/core';

import { ErrorCache } from './error-cache.js';
import { Feedback } from './feedback.js';
import { ruleSetFlag } from './flags/rule-set-flag.js';
import { specFlag } from './flags/spec-flag.js';
import { trafficFlag } from './flags/traffic-flag.js';
import { getConfig } from './get-config.js';
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
  static override enableJsonFlag = true;

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
      default: 'thymian.config.yaml',
      helpGroup: 'BASE',
    }),
    autoload: Flags.boolean({
      allowNo: true,
      description:
        'Disable automatic loading and initialization of plugins based on configuration file.',
      helpGroup: 'BASE',
    }),
    plugin: Flags.string({
      multiple: true,
      charAliases: ['p'],
      default: [],
      helpGroup: 'BASE',
    }),
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
  };

  protected flags!: CommandFlags<T>;
  protected args!: CommandArgs<T>;
  protected logger!: Logger;
  protected thymianConfig!: ThymianConfig;
  protected thymian!: Thymian;
  protected feedback!: Feedback;
  protected errorCache!: ErrorCache;

  public override async init(): Promise<void> {
    await super.init();
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

    this.thymianConfig = await getConfig(this.flags.config, this.flags.cwd);

    const logLevel = this.resolveLogLevelWithConfig();

    this.logger = new TextLogger('@thymian/cli', logLevel);

    this.thymian = new Thymian(this.logger.child('@thymian/core'), {
      timeout: this.flags.timeout,
      cwd: this.flags.cwd,
      idleTimeout: this.flags['idle-timeout'],
    });
    this.feedback = Feedback.forCommand(this);
    this.errorCache = ErrorCache.forCommand(this);

    if (this.shouldAutoload()) {
      this.debug('Autoloading Thymian plugins.');
      await this.addPluginsToThymianConfig();
      await this.registerPluginsFromConfig();
    }

    await this.feedback.run();
  }

  protected override async catch(err: CommandError): Promise<void> {
    await this.feedback.error();
    const versionDetails = this.config.versionDetails;

    const pluginVersions = Object.entries(versionDetails.pluginVersions ?? {})
      .filter(([name]) => !name.startsWith('@oclif'))
      .map(([name, version]) => ({ name, version: version.version }));

    await this.errorCache.write({
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
        console.log(err.cause);
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
   * Resolve the effective log level from flags and config.
   * Priority: --log-level flag > --debug flag > --verbose flag > config logLevel > default 'warn'
   */
  private resolveLogLevel(): LogLevel {
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

    return 'warn';
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
        ? join(this.flags.cwd, options.path ?? nameOrPath)
        : nameOrPath;

    let pluginModule;

    this.debug('Load plugin module from location "%s".', location);

    try {
      pluginModule = (await import(require.resolve(location))).default;
    } catch (e) {
      pluginModule = {};
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

      if ((await this.isNpmPackage(plugin)) || isAbsolute(plugin)) {
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

  private async isNpmPackage(name: string): Promise<boolean> {
    try {
      require.resolve(name, { paths: [this.flags.cwd] });
      return true;
    } catch {
      return false;
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
}
