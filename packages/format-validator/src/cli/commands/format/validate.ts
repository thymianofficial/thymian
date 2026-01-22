import { BaseCliRunCommand } from '@thymian/cli-common';

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  async run(): Promise<void> {
    const valid = await this.thymian.run(async (emitter) => {
      const format = await this.thymian.loadFormat(this.filter);

      return await emitter.emitAction('format-validator.validate', {
        format: format.export(),
      });
    });

    if (!valid.every(Boolean)) {
      this.exit(1);
    }
  }
}
