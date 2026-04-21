import { load, validate } from '@scalar/openapi-parser';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { BaseCliRunCommand } from '@thymian/common-cli';
import { Args } from '@thymian/common-cli/oclif';

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override requiresSpecifications = false;

  static override args = {
    file: Args.string({
      description: 'Path to the OpenAPI or Swagger document to validate.',
      required: true,
    }),
  };
  static override description =
    'Validate an OpenAPI or Swagger document and exit non-zero on errors.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> openapi.yaml',
  ];

  override async run(): Promise<void> {
    const filesystem = (
      await load(this.args.file, { plugins: [readFiles()], throwOnError: true })
    ).filesystem;

    const result = await validate(filesystem);

    if (!result.valid) {
      if (result.errors) {
        this.log('\u274C Invalid Swagger/OpenAPI file with errors:');
        console.group();
        result.errors.forEach((e) =>
          this.log(`* ${e.message}${'path' in e ? ` (at "${e.path}")` : ''}`),
        );
        console.groupEnd();
      }
      this.exit(1);
    }

    this.log('\u2705 Valid Swagger/OpenAPI file.');
  }
}
