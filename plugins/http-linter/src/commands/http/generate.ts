import { BaseCliCommand } from '@thymian/cli-common';

export default class Generate extends BaseCliCommand<typeof Generate> {
  override async run(): Promise<void> {
    this.logger.out(`export default httpRule('my-rule')`);
  }
}
