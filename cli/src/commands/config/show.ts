import { BaseCliRunCommand } from '@thymian/cli-common';
import { Flags, ux } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';

export default class ShowConfig extends BaseCliRunCommand<typeof ShowConfig> {
  static override description = 'Show the current Thymian configuration.';

  static override flags = {
    yaml: Flags.boolean({
      default: false,
      allowNo: true,
      description: 'Output configuration in YAML format.',
    }),
  };
  public async run(): Promise<void> {
    if (this.flags.yaml) {
      this.log(stringify(this.thymianConfig));
    } else {
      this.log(
        ux.colorizeJson(this.thymianConfig, {
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
        }),
      );
    }
  }
}
