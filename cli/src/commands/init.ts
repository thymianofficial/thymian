import { BaseCliRunCommand, defaultConfig } from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';

export default class Init extends BaseCliRunCommand<typeof Init> {
  static override description = 'Generate Thymian configuration file.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    yaml: Flags.boolean({
      default: false,
      description: 'Output configuration file in YAML format.',
    }),
  };

  public async run(): Promise<void> {
    if (this.flags.yaml) {
      this.log(stringify(defaultConfig));
    } else {
      this.log(JSON.stringify(defaultConfig, null, 2));
    }
  }
}
