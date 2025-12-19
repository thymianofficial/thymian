import { settings } from '@oclif/core';
import { BaseCliRunCommand } from '@thymian/cli-common';
import ora from 'ora';

const growingPlant = {
  interval: 200,
  frames: ['.', '🌱', '🌿', '☘️', '🍀'],
};
const text = 'Spicing up your API...';

export default class Run extends BaseCliRunCommand<typeof Run> {
  static override description =
    'Run Thymian and the corresponding plugins specified in the Thymian configuration and via CLI.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

  override async run(): Promise<void> {
    const spinner = ora({
      spinner: growingPlant,
      prefixText: text,
    });

    if (!this.flags.verbose) {
      spinner.start();
    }

    const results = await this.thymian.run(async (emitter) => {
      emitter.onAction('core.close', (_, ctx) => {
        if (!this.flags.verbose) {
          spinner.succeed('Spiced up! 🌱');
        }

        ctx.reply();
      });

      const format = await this.thymian.loadFormat();

      return await emitter.emitAction('core.run', format.export(), {
        strategy: 'collect',
        timeout: 20000,
      });
    });

    const errorResult = results.find((r) => r.status === 'error');

    if (errorResult) {
      this.logger.debug(
        `Plugin ${errorResult.pluginName} returned erroneous result.`,
      );
      this.exit(1);
    }

    const failed = results.filter((r) => r.status === 'failed');

    if (failed.length > 0) {
      const names = failed.map((f) => f.pluginName);

      this.logger.debug(
        `Plugin${failed.length > 1 ? 's' : ''} ${names.join(', ')} failed.`,
      );

      this.exit(1);
    }
  }
}
