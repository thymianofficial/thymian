import { BaseCliCommand } from '@thymian/cli-common';

export default class ShowConfig extends BaseCliCommand<typeof ShowConfig> {
  static override description =
    'Show the current configurations of registered plugins.';

  public async run(): Promise<void> {
    await this.thymian.ready();

    for (const plg of this.thymian.plugins) {
      this.log(plg.plugin.name);
      this.log(plg.options);
    }

    await this.thymian.close();
  }
}
