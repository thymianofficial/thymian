import { BaseCliRunCommand, oclif, prompts } from '@thymian/common-cli';

export default class Init extends BaseCliRunCommand<typeof Init> {
  static override description =
    'Generate initial sampler files for the current API specification.';

  static override flags = {
    overwrite: oclif.Flags.boolean({
      default: false,
      description: 'Overwrite existing samples.',
    }),

    check: oclif.Flags.boolean({
      description:
        'After initialization, run sampler check to verify all transactions can be executed.',
      allowNo: true,
      default: false,
    }),
  };

  async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      if (
        !this.thymian.plugins.find(
          (p) => p.plugin.name === '@thymian/plugin-sampler',
        )
      ) {
        this.error(
          'Cannot initialize sampler if sampler plugin is not registered.',
          {
            exit: 1,
          },
        );
      }

      const format = await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        {
          emitFormat: true,
        },
      );

      await emitter.emitAction('sampler.init', {
        format: format.export(),
        overwrite: this.flags.overwrite,
      });
    });

    this.log(oclif.ux.colorize('green', 'Sampler initialized.'));

    if (this.flags.check) {
      if (this.config.findCommand('sampler check')) {
        this.log();
        const answer = await prompts.confirm({
          message: 'Do you want to run this check now?',
        });

        if (answer) {
          this.log();

          const args = ['--cwd', this.flags.cwd];

          if (this.flags.config) {
            args.push('-c', this.flags.config);
          }

          await this.config.runCommand('sampler check', args);
        }
      }
    } else {
      this.log();
      this.log('To check if every transaction can be executed, run:');
      this.log();
      this.log('$ thymian sampler check');
      this.log();
    }
  }
}
