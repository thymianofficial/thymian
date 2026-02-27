import { validate } from '@scalar/openapi-parser';
import { BaseCliRunCommand } from '@thymian/cli-common';
import { Args } from '@thymian/cli-common/oclif';
import { ThymianBaseError } from '@thymian/core';

import { loadOpenApi } from '../../../load-openapi.js';

export default class Info extends BaseCliRunCommand<typeof Info> {
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
    const { document } = await loadOpenApi(this.args.content, this.flags.cwd);

    const { valid, version, specification } = await validate(document);

    if (!valid || !specification) {
      throw new ThymianBaseError('Invalid OpenAPI document.', {
        name: 'InvalidOpenAPIDocumentError',
        ref: 'https://thymian.dev/references/errors/invalid-openapi-document-error/',
        suggestions: [
          'Use thymian openapi:validate to validate your OpenAPI document.',
        ],
      });
    }

    this.log(`OpenAPI version: ${version}`);
    this.log(`API Title: ${specification.info.title}`);
    this.log(`API Version: ${specification.info.version}`);
  }
}
