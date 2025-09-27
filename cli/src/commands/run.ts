import { BaseCliRunCommand } from '@thymian/cli-common';

export default class Run extends BaseCliRunCommand<typeof Run> {
  static override description =
    'Run Thymian and the corresponding plugins specified in the Thymian configuration and via CLI.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

  override async run(): Promise<void> {
    const results = await this.thymian.run(async (emitter) => {
      const format = await this.thymian.loadFormat();

      return await emitter.emitAction('core.run', format.export());
    });

    const errorResult = results.find((r) => r.status === 'error');

    if (errorResult) {
      this.logger.debug(
        `Plugin ${errorResult.pluginName} returned erroneous result.`,
      );
      this.exit(1);
    }
  }
}
