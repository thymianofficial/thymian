import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';

import { Command, Flags, Interfaces, settings } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import {
  and,
  type HttpFilterExpression,
  isPlugin,
  type Logger,
  TextLogger,
  Thymian,
  ThymianBaseError,
  type ThymianPlugin,
} from '@thymian/core';

import { ErrorCache } from './error-cache.js';
import { Feedback } from './feedback.js';
import { filterFlag } from './flags/filter-flag.js';
import { optionFlag, optionRegexp } from './flags/option-flag.js';
import { getConfig } from './get-config.js';
import { safeParse } from './safe-parse.js';
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
      aliases: ['debug'],
      charAliases: ['d'],
      description: 'Run thymian in debug mode.',
      helpGroup: 'BASE',
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
    option: optionFlag(),
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
    'trace-events': Flags.boolean({
      default: false,
      description: 'All events that are emitted will be logged.',
      helpGroup: 'BASE',
    }),
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
    filter: filterFlag(),
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
  public filter!: HttpFilterExpression;
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
    this.flags.verbose = settings.debug || this.flags.verbose;
    this.logger = new TextLogger('@thymian/cli', this.flags.verbose);
    this.thymian = new Thymian(this.logger.child('@thymian/core'), {
      timeout: this.flags.timeout,
      traceEvents: this.flags['trace-events'],
      cwd: this.flags.cwd,
      idleTimeout: this.flags['idle-timeout'],
    });
    this.feedback = Feedback.forCommand(this);
    this.errorCache = ErrorCache.forCommand(this);

    this.thymianConfig = await getConfig(this.flags.config, this.flags.cwd);
    this.overridePluginOptions();

    this.filter = and(...(this.flags.filter ?? []));

    if (Array.isArray(this.thymianConfig.filters)) {
      this.filter = and(...this.thymianConfig.filters, this.filter);
    }

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

  public setThymian(thymian: Thymian): void {
    this.thymian = thymian;
  }

  protected overridePluginOptions(): void {
    if (!this.flags.option) {
      return;
    }

    for (const option of this.flags.option) {
      const match = optionRegexp.exec(option);

      if (!match) {
        throw new CLIError(
          `Expected option flag with format <pluginName>.<property>=<value>, but got: ${option}`,
        );
      }

      const [, pluginName, property, value] = match;

      if (!pluginName || !property || !value) {
        throw new CLIError(
          `Expected option flag with format <pluginName>.<property>=<value>, but got option with pluginName "${pluginName}", property "${property}" and value ${value}.`,
        );
      }

      if (!this.thymianConfig.plugins[pluginName]?.options) {
        this.thymianConfig.plugins[pluginName] ??= {};
        this.thymianConfig.plugins[pluginName].options = {};
      }

      this.thymianConfig.plugins[pluginName].options[property] =
        safeParse(value);
    }
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
