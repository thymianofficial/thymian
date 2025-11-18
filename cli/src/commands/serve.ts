import { BaseCliRunCommand } from '@thymian/cli-common';

export default class Serve extends BaseCliRunCommand<typeof Serve> {
  static override description = 'Run Thymian in serve mode.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

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

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('data', async (data) => {
      if (data.toString() === 'q') {
        await close(0);
      }
    });

    await this.thymian.ready();

    this.log('Thymian is now in "serve" mode. Press "q" to exit.');
  }
}
