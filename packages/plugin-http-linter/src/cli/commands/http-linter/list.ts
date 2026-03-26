import { join } from 'node:path';

import { BaseCliRunCommand } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';
import { loadRules } from '@thymian/core';

export default class ListCommand extends BaseCliRunCommand<typeof ListCommand> {
  static override description = 'List all loaded rules.';

  static override flags = {
    rules: Flags.string({
      multiple: true,
      default: [],
      description: 'Rules or rule sets to include.',
    }),
  };

  async run(): Promise<void> {
    const ruleSources = this.flags.rules.map((rule) =>
      join(process.cwd(), rule),
    );

    const rules = await loadRules(ruleSources);

    rules.forEach((r) => this.log(r.meta.name));
  }
}
