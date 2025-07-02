import { BaseCliCommand, defaultConfig } from '@thymian/cli-common';
import { Flags, Errors } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';

export default class Init extends BaseCliCommand<typeof Init> {
  static override description = 'Generate Thymian configuration file.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    yaml: Flags.boolean({
      default: false,
      description: 'Output configuration file in YAML format.',
    }),
  };

  public async run(): Promise<void> {
    throw new Errors.CLIError('HAHAHA', {
      code: 'Super cool code',
      message: 'You should listen to me',
      ref: 'http://localhost:8080',
      suggestions: ['Look on github.'],
    });

    if (this.flags.yaml) {
      this.log(stringify(defaultConfig));
    } else {
      this.log(JSON.stringify(defaultConfig, null, 2));
    }
  }
}
