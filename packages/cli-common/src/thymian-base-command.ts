import { Command, Flags, Interfaces, settings } from '@oclif/core';
import { CLIError } from '@oclif/core/errors';
import type { CommandError } from '@oclif/core/interfaces';
import { ThymianBaseError } from '@thymian/core';

import { ErrorCache } from './error-cache.js';
import { Feedback } from './feedback.js';

type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof ThymianBaseCommand)['baseFlags'] & T['flags']
>;
type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export abstract class ThymianBaseCommand<
  T extends typeof Command,
> extends Command {
  static override enableJsonFlag = true;

  static override baseFlags = {
    ['suppress-feedback']: Flags.boolean({
      default: false,
      description: 'Suppress feedback messages from Thymian.',
      helpGroup: 'BASE',
    }),
  };

  protected flags!: Flags<T>;
  protected args!: Args<T>;
  protected feedback!: Feedback;
  protected errorCache!: ErrorCache;

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof ThymianBaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
    this.feedback = Feedback.forCommand(this);
    this.errorCache = ErrorCache.forCommand(this);

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

  public shouldSuppressFeedback(): boolean {
    return this.flags['suppress-feedback'];
  }
}
