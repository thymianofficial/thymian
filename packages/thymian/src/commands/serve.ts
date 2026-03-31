import { BaseCliRunCommand } from '@thymian/cli-common';

export default class Serve extends BaseCliRunCommand<typeof Serve> {
  static override description = 'Run Thymian in serve mode.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];
  static override requiresSpecifications = false;

  override async run(): Promise<void> {
    const close = async (code = 0) => {
      this.debug('Closing Thymian.');

      await this.thymian.close();

      process.exit(code);
    };

    process.on('SIGINT', close);

    this.thymian.emitter.on('core.exit', async ({ code }) => {
      await this.thymian.close();

      await close(code);
    });

    const quit = 'q';

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', async (data) => {
      if (data.toString() === quit) {
        await close(0);
      }
    });

    await this.thymian.ready();

    this.log(`Thymian is now in "serve" mode. Press "${quit}" to exit.`);
  }
}
