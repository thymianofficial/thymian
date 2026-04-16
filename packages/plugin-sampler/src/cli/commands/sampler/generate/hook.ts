import { BaseCliRunCommand } from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';

import { generateHook } from '../../../generate-hook.js';

export default class GenerateHook extends BaseCliRunCommand<
  typeof GenerateHook
> {
  static override aliases = ['sampler g h', 'sampler generate h'];

  static override flags = {
    'for-transaction': Flags.string({
      description: 'For which transaction do you want to generate a hook?',
      required: false,
    }),
  };

  override async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      await generateHook(
        this.thymian,
        emitter,
        this,
        this.flags.cwd,
        this.flags['skip-spec-validation'],
        this.flags['for-transaction'],
      );
    });
  }
}
