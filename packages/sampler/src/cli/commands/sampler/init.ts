import { BaseCliRunCommand, oclif } from '@thymian/cli-common';

export default class Init extends BaseCliRunCommand<typeof Init> {
  async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      const format = await this.thymian.loadFormat();

      return await emitter.emitAction('sampler.init', {
        format: format.export(),
      });
    });

    this.log(oclif.ux.colorize('green', 'Sampler initialized.'));
  }
}
