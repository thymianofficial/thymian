import { BaseCliRunCommand, oclif } from '@thymian/cli-common';

export default class Init extends BaseCliRunCommand<typeof Init> {
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

      const format = await this.thymian.loadFormat();

      return await emitter.emitAction('sampler.init', {
        format: format.export(),
      });
    });

    this.log(oclif.ux.colorize('green', 'Sampler initialized.'));
  }
}
