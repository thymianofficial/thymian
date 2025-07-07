import { join } from 'node:path';

import { BaseCliCommand } from '@thymian/cli-common';
import { Args, Flags } from '@thymian/cli-common/oclif';
import Fuse from 'fuse.js';

export default class SearchCommand extends BaseCliCommand<
  typeof SearchCommand
> {
  static override args = {
    searchText: Args.string({
      description: 'Text to search for.',
    }),
  };

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

    const fuse = new Fuse(rules, {
      keys: ['meta.description'],
      findAllMatches: true,
      useExtendedSearch: true,
      threshold: 0.7,
      distance: 100,
    });
    console.log(this.args.searchText);

    await this.thymian.close();

    console.log(
      fuse.search(this.args.searchText ?? '').map((r) => r.item.meta.name)
    );
  }
}
