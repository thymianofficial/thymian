import { validate } from '@scalar/openapi-parser';
import { BaseCliRunCommand } from '@thymian/common-cli';
import { Args } from '@thymian/common-cli/oclif';
import { ThymianBaseError } from '@thymian/core';

import { loadOpenApi } from '../../../load-openapi.js';

export default class Info extends BaseCliRunCommand<typeof Info> {
  static override requiresSpecifications = false;

  static override args = {
    content: Args.string({
      description: 'Path to the OpenAPI or Swagger document to inspect.',
      required: true,
      ignoreStdin: false,
    }),
  };
  static override description =
    'Print summary information for an OpenAPI or Swagger document.';
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
