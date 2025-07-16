import { BaseCliRunCommand } from '@thymian/cli-common';

export default class ValidateFormat extends BaseCliRunCommand<
  typeof ValidateFormat
> {
  async run(): Promise<void> {
    await this.thymian.ready();

    const format = await this.thymian.loadFormat();

    await this.thymian.emitter.emitAction('format-validator.validate', {
      format: format.export(),
    });

    await this.thymian.close();
  }
}
