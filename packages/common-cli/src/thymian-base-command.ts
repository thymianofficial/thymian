import { Command, Flags, Interfaces } from '@oclif/core';
import type { CommandError } from '@oclif/core/interfaces';

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
  protected feedback?: Feedback;
  protected errorCache?: ErrorCache;

  public override async init(): Promise<void> {
    await super.init();

    this.errorCache = ErrorCache.forCommand(this);

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

    await this.feedback.run();
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
    return super.catch(err);
  }

  public shouldSuppressFeedback(): boolean {
    return this.flags['suppress-feedback'];
  }
}
