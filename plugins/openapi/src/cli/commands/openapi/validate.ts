import { load, validate } from '@scalar/openapi-parser';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { BaseCliRunCommand } from '@thymian/cli-common';
import { Args } from '@thymian/cli-common/oclif';

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override args = {
    file: Args.string({ description: 'file to read', required: true }),
  };
  static override description =
    'Load and parse the given Swagger/OpenAPI file to the Thymian format.';
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
        result.errors.forEach((e) => this.log(`* ${e.message}`));
        console.group();
      }
      this.exit(1);
    }

    this.log('\u2705 Valid Swagger/OpenAPI file.');
  }
}
