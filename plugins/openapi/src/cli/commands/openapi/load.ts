import { BaseCliRunCommand } from '@thymian/cli-common';
import { Args } from '@thymian/cli-common/oclif';

import { defaultOpenApiPluginOptions } from '../../../index.js';
import { loadOpenapi } from '../../../load-openapi.js';

export default class Load extends BaseCliRunCommand<typeof Load> {
  static override args = {
    file: Args.string({ description: 'file to read', required: true }),
  };
  static override description =
    'Load and parse the given Swagger/OpenAPI file to the Thymian format.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> openapi.yaml',
  ];

  override async run(): Promise<void> {
    const [format] = await loadOpenapi(this.logger, {
      ...defaultOpenApiPluginOptions,
      filePath: this.args.file,
    });

    console.log(JSON.stringify(format.export()));
  }
}
