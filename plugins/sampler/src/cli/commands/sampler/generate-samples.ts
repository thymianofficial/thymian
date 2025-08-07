import { BaseCliRunCommand } from '@thymian/cli-common';

export default class GenerateSamples extends BaseCliRunCommand<
  typeof GenerateSamples
> {
  async run(): Promise<void> {
    await this.thymian.run(async (emitter) => {
      const format = await this.thymian.loadFormat();

      return await emitter.emitAction('sampler.generate', {
        format: format.export(),
      });
    });
  }
}
