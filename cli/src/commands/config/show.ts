import { BaseCliRunCommand } from '@thymian/cli-common';
import { ux } from '@thymian/cli-common/oclif';

export default class ShowConfig extends BaseCliRunCommand<typeof ShowConfig> {
  static override description =
    'Show the current configurations of registered plugins.';
  public async run(): Promise<void> {
    await this.thymian.run(() => {
      for (const [name, config] of Object.entries(this.thymianConfig.plugins)) {
        this.logLine(name.length);
        this.log(ux.colorize('bold', name));
        this.logLine(name.length);
        this.log(
          ux.colorizeJson(config, {
            pretty: true,
            theme: {
              brace: '#00FFFF',
              bracket: 'rgb(0, 255, 255)',
              colon: 'dim',
              comma: 'yellow',
              key: 'bold',
              string: 'green',
              number: 'blue',
              boolean: 'cyan',
              null: 'redBright',
            },
          })
        );
        this.log();
      }
    });
  }

  private logLine(length: number): void {
    this.log(
      Array.from({ length })
        .map(() => '-')
        .join('')
    );
  }
}
