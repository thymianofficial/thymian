import { BaseCliRunCommand } from '@thymian/common-cli';
import { Args } from '@thymian/common-cli/oclif';
import { constant } from '@thymian/core';

import { loadAndTransform } from '../../../load-openapi.js';

export default class Load extends BaseCliRunCommand<typeof Load> {
  static override requiresSpecifications = false;

  static override args = {
    content: Args.string({
      description: 'file to read',
      required: true,
      ignoreStdin: false,
    }),
  };
  static override description =
    'Load and parse the given Swagger/OpenAPI file to the Thymian format.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> openapi.yaml',
  ];

  override async run(): Promise<void> {
    const [, format] = await loadAndTransform(this.args.content, {
      filter: constant(true),
      cwd: this.flags.cwd,
      logger: this.logger,
      serverInfo: {
        port: 8080,
        host: 'localhost',
        protocol: 'http',
        basePath: '',
      },
    });

    this.log(JSON.stringify(format.export()));
  }
}
