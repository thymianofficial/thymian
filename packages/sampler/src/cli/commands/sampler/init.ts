import { BaseCliRunCommand, oclif, prompts } from '@thymian/cli-common';

export default class Init extends BaseCliRunCommand<typeof Init> {
  static override flags = {
    overwrite: oclif.Flags.boolean({
      default: false,
      description: 'Overwrite existing samples.',
    }),
  };

  async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      if (
        !this.thymian.plugins.find((p) => p.plugin.name === '@thymian/sampler')
      ) {
        this.error(
          'Cannot initialize sampler if sampler plugin is not registered.',
          {
            exit: 1,
          },
        );
      }

      const format = await this.thymian.loadFormat({ emitFormat: true });

      await emitter.emitAction('sampler.init', {
        format: format.export(),
        overwrite: this.flags.overwrite,
      });
    });

    this.log(oclif.ux.colorize('green', 'Sampler initialized.'));
    this.log();
    this.log('To check if every transaction can be executed, run:');
    this.log();
    this.log('$ thymian format:check');
    this.log();
    if (this.config.findCommand('format:check')) {
      const answer = await prompts.confirm({
        message: 'Do you want to run this check now?',
      });

      if (answer) {
        this.log();

        await this.config.runCommand('format:check', [
          '-c',
          this.flags.config,
          '--cwd',
          this.flags.cwd,
        ]);
      }
    }
  }
}
