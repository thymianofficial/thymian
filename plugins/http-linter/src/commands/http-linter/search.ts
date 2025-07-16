import { join } from 'node:path';

import { BaseCliRunCommand } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';
import Fuse from 'fuse.js';

export default class SearchCommand extends BaseCliRunCommand<
  typeof SearchCommand
> {
  static override flags = {
    rules: Flags.string({
      multiple: true,
      default: [],
      description: 'Rules or rule sets to include.',
    }),
    for: Flags.string({
      multiple: false,
      description: 'Search for.',
      required: true,
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

    const fuse = new Fuse(rules, {
      keys: ['meta.description'],
      findAllMatches: true,
      threshold: 0.3,
      ignoreLocation: true,
      distance: 100,
      minMatchCharLength: 2,
      useExtendedSearch: false,
      includeScore: true,
    });

    await this.thymian.close();

    fuse
      .search(this.flags.for)
      .map((r) => `${r.item.meta.name} (score: ${r.score})`)
      .forEach((r) => console.log(r));
  }
}
