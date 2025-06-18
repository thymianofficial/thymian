import { Command, Flags, Interfaces } from '@oclif/core';
import { type Logger, NoopLogger, TextLogger } from '@thymian/core';

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCliCommand)['baseFlags'] & T['flags']
>;
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export abstract class BaseCliCommand<T extends typeof Command> extends Command {
  static override enableJsonFlag = true;

  static override baseFlags = {
    verbose: Flags.boolean({ default: false, aliases: ['debug'] }),
  };

  protected flags!: Flags<T>;
  protected args!: Args<T>;
  protected logger: Logger = new NoopLogger();

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCliCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
    this.logger = new TextLogger('CLI', this.flags.verbose);
  }
}
