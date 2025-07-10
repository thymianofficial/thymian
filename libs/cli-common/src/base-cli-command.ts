import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, parse } from 'node:path';

import { Command, Errors, Flags, Interfaces, settings } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import {
  isPlugin,
  isRecord,
  type Logger,
  TextLogger,
  Thymian,
  ThymianBaseError,
  type ThymianPlugin,
  validate,
} from '@thymian/core';

import { getConfig } from './get-config.js';
import { optionFlag, optionRegexp } from './option-flag.js';
import { safeParse } from './safe-parse.js';
import type { ThymianConfig } from './thymian-config.js';

const require = createRequire(import.meta.url);

export type CommandFlags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCliCommand)['baseFlags'] & T['flags']
>;
export type CommandArgs<T extends typeof Command> = Interfaces.InferredArgs<
  T['args']
>;

export abstract class BaseCliCommand<T extends typeof Command> extends Command {
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
      default: 5000,
      charAliases: ['t'],
      description:
        'Set the duration in ms to wait until a plugin is registered.',
      helpGroup: 'BASE',
    }),
    'trace-events': Flags.boolean({
      default: false,
      description:
        'All events that are emitted will be logged. Must be used in debug mode.',
      dependsOn: ['verbose'],
      helpGroup: 'BASE',
    }),
  };

  protected flags!: CommandFlags<T>;
  protected args!: CommandArgs<T>;
  protected logger!: Logger;
  protected thymianConfig!: ThymianConfig;
  protected thymian!: Thymian;

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCliCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as CommandFlags<T>;
    this.args = args as CommandArgs<T>;
    this.logger = new TextLogger('CLI', this.flags.verbose);
    this.thymian = new Thymian(this.logger.child('THYMIAN'), {
      timeout: this.flags.timeout,
      traceEvents: this.flags['trace-events'],
    });

    this.thymianConfig = await getConfig(this.flags.config);
    this.overridePluginOptions();

    if (this.shouldAutoload()) {
      this.debug('Autoload plugins.');
      await this.addPluginsToThymianConfig();
      await this.registerPluginsFromConfig();
    }
  }

  protected override catch(err: CommandError): Promise<any> {
    if (err instanceof ThymianBaseError) {
      const cliError = new CLIError(err.message, {
        suggestions: err.options.suggestions,
        exit: err.options.exitCode,
        code: err.options.code,
      });

      cliError.name = err.name;
      Object.defineProperty(cliError, 'ref', { value: err.options.ref });

      if (settings.debug) {
        if (this.jsonEnabled() && err.options.cause) {
          this.logJson(this.toErrorJson(err.options.cause));
        } else if (err.options.cause) {
          console.log(err.options.cause);
        }
      }

      return super.catch(cliError);
    }

    return super.catch(err);
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
    for (const option of this.flags.option) {
      const match = optionRegexp.exec(option);

      if (!match) {
        this.error('Invalid override value.');
      }

      const [, pluginName, property, value] = match;

      if (!pluginName || !property || !value) {
        this.error('Invalid override value.');
      }

      if (!(pluginName in this.thymianConfig.plugins)) {
        this.thymianConfig.plugins[pluginName] = {
          options: {},
        };
      }

      if (!isRecord(this.thymianConfig.plugins[pluginName]!.options)) {
        this.thymianConfig.plugins[pluginName]!.options = {};
      }

      // TODO
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      this.thymianConfig.plugins[pluginName].options[property] =
        safeParse(value);
    }
  }

  protected async loadPluginModule(
    nameOrPath: string,
    isRelativePath = false
  ): Promise<ThymianPlugin | undefined> {
    const options = this.thymianConfig.plugins[nameOrPath] ?? {};
    const location =
      isRelativePath || typeof options.path === 'string'
        ? join(process.cwd(), options.path ?? nameOrPath)
        : nameOrPath;

    const pluginModule = (await import(require.resolve(location))).default;

    return isPlugin(pluginModule) ? pluginModule : undefined;
  }

  protected async registerPlugin(
    nameOrPath: string,
    isRelativePath = false
  ): Promise<void> {
    const pluginModule = await this.loadPluginModule(
      nameOrPath,
      isRelativePath
    );

    if (!pluginModule) {
      this.logger.error(
        `Plugin "${nameOrPath}" does not default export valid thymian plugin and is therefore not imported.`
      );
      return;
    }

    const config = this.thymianConfig.plugins[pluginModule.name] ?? {};

    if (typeof config.autoload === 'boolean' && !config.autoload) {
      return;
    }

    const options = config.options ?? {};

    const valid = pluginModule.options
      ? validate(pluginModule.options, options)
      : true;

    if (!valid) {
      this.logger.error(
        `Plugin "${pluginModule.name}" options are not valid and will not be registered.`
      );
      return;
    }

    this.thymian.register(pluginModule, options);
  }

  protected async addPluginsToThymianConfig(): Promise<void> {
    for (const plugin of this.flags.plugin) {
      const { dir } = parse(plugin);

      if ((!dir && existsSync(plugin)) || dir) {
        const pluginModule = await this.loadPluginModule(plugin, true);

        if (!pluginModule) {
          throw new Errors.CLIError(`Cannot load plugin ${plugin}.`);
        }

        this.thymianConfig.plugins[pluginModule.name] = {
          ...(this.thymianConfig.plugins[pluginModule.name] ?? {}),
          path: plugin,
        };
      } else {
        const pluginModule = await this.loadPluginModule(plugin, false);

        if (!pluginModule) {
          throw new Errors.CLIError(`Cannot load plugin ${plugin}.`);
        }

        this.thymianConfig.plugins[pluginModule.name] ??= {};
      }
    }
  }

  protected async registerPluginsFromConfig(): Promise<void> {
    for (const name of Object.keys(this.thymianConfig.plugins)) {
      await this.registerPlugin(name);
    }
  }
}
