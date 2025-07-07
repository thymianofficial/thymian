import { join } from 'node:path';

import { BaseCliCommand } from '@thymian/cli-common';
import { Flags, ux } from '@thymian/cli-common/oclif';

export default class ListCommand extends BaseCliCommand<typeof ListCommand> {
  static override description = 'List all loaded rules.';

  static override flags = {
    rules: Flags.string({
      multiple: true,
      default: [],
      description: 'Rules or rule sets to include.',
    }),
  };

  async run(): Promise<void> {
    await this.thymian.ready();

    if (this.flags.rules.length > 0) {
      await this.thymian.emitter.emitAction('http-linter.load-rules', {
        rules: this.flags.rules.map((rule) => join(process.cwd(), rule)),
      });
    }

    const rules = (
      await this.thymian.emitter.emitAction('http-linter.rules')
    ).flat();

    await this.thymian.close();

    rules.forEach((r) => console.log(r.meta.name));
  }
}
