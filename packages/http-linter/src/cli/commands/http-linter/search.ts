import { join } from 'node:path';

import { BaseCliRunCommand } from '@thymian/cli-common';
import { Flags, ux } from '@thymian/cli-common/oclif';
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
    const rules = await this.thymian.run(async (emitter) => {
      if (this.flags.rules.length > 0) {
        await emitter.emitAction('http-linter.load-rules', {
          rules: this.flags.rules.map((rule) => join(process.cwd(), rule)),
        });
      }

      return (await emitter.emitAction('http-linter.rules')).flat();
    });

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

    for (const { item, score } of fuse.search(this.flags.for)) {
      this.log(
        `${ux.colorize('bold', item.meta.name)} ${ux.colorize(
          'dim',
          `(confidence: ${score})`,
        )}`,
      );
      console.group();
      this.log(item.meta.summary);
      console.groupEnd();
      this.log();
    }
  }
}
