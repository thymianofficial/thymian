import { BaseCliCommand } from '@thymian/cli-common';
import { Args, Flags } from '@thymian/cli-common/oclif';

import { loadOpenapi } from '../../load-openapi.js';

export default class Load extends BaseCliCommand<typeof Load> {
  static override args = {
    file: Args.string({ description: 'file to read', required: true }),
  };
  static override description =
    'Load and parse the given Swagger/OpenAPI file to the Thymian format.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> openapi.yaml',
  ];
  static override flags = {
    port: Flags.integer({
      description: 'Port of the server under test.',
      default: 8080,
    }),
    fetchExternalRefs: Flags.boolean({
      description: 'Allow to automatically fetch external files if necessary',
      default: false,
    }),
    allowExternalFiles: Flags.boolean({
      description: 'Allow to fetch external files.',
      default: true,
    }),
  };

  override async run(): Promise<void> {
    console.log(
      (
        await loadOpenapi(this.logger, {
          filePath: this.args.file,
          port: this.flags.port,
          fetchExternalRefs: this.flags.fetchExternalRefs,
          allowExternalFiles: this.flags.allowExternalFiles,
        })
      ).export()
    );
  }
}
