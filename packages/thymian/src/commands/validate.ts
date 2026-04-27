import {
  BaseCliRunCommand,
  classificationToExitCode,
} from '@thymian/common-cli';
import { ux } from '@thymian/common-cli/oclif';

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override description =
    'Validate API specifications resolved from config or --spec.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --spec openapi:./openapi.yaml',
  ];

  override async run(): Promise<void> {
    const specifications = this.thymianConfig.specifications ?? [];

    if (specifications.length === 0) {
      this.error(
        'No specification found. Provide a specification with --spec or create a configuration file.',
        {
          exit: 2,
        },
      );
    }

    const outcome = await this.thymian.run(async () => {
      return await this.thymian.validate({
        specification: specifications,
      });
    });

    const exitCode = classificationToExitCode(outcome.classification);

    for (const result of outcome.results) {
      const icon =
        result.status === 'success'
          ? '✓'
          : result.status === 'failed'
            ? '✖'
            : '⚠';

      ux.stdout(`${icon} ${result.location}`);

      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          ux.stdout(
            `    - ${issue.message}${issue.path ? ` (at ${issue.path})` : ''}`,
          );
        }
        ux.stdout();
      }
    }

    if (exitCode === 0) {
      ux.stdout('All specifications are valid.');
    } else if (exitCode === 1) {
      ux.stdout(
        `\n${outcome.results.filter((r) => r.status === 'failed').length} of ${specifications.length} specifications are invalid.`,
      );
    } else {
      ux.stdout(
        `\n${outcome.results.filter((r) => r.status === 'unsupported' || r.status === 'error').length} of ${specifications.length} specifications could not be validated.`,
      );
    }

    this.exit(exitCode);
  }
}
