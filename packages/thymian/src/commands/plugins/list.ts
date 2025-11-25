import { EOL } from 'node:os';

import { BaseCliRunCommand } from '@thymian/cli-common';
import { ux } from '@thymian/cli-common/oclif';

export default class List extends BaseCliRunCommand<typeof List> {
  static override description = 'List all registered Thymian plugins.';

  public async run(): Promise<void> {
    await this.thymian.run(() => {
      this.log(
        this.thymian.plugins
          .map((plugin) =>
            ux.colorize(this.config?.theme?.topic, plugin.plugin.name),
          )
          .join(EOL),
      );
    });
  }
}
