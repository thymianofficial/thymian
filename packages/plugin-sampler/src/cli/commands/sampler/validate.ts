import { BaseCliRunCommand, oclif } from '@thymian/common-cli';

export default class Validate extends BaseCliRunCommand<typeof Validate> {
  static override enableJsonFlag = true;

  static override description =
    'Check the sampler hooks against the current API description, and the committed types against both.';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  override async run(): Promise<unknown> {
    return this.thymian.run(async (emitter) => {
      await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        { emitFormat: true },
      );

      const report = await emitter.emitAction(
        'sampler.validate',
        {},
        { strategy: 'first' },
      );

      if (this.jsonEnabled()) {
        if (report.outcome === 'broken' || report.outcome === 'drifted') {
          process.exitCode = 1;
        }

        return report;
      }

      for (const warning of report.warnings) {
        this.log(oclif.ux.colorize('yellow', `! ${warning}`));
      }

      for (const problem of [...report.unresolved, ...report.conflicts]) {
        const where = problem.exportName
          ? `${problem.file} (export "${problem.exportName}")`
          : problem.file;

        this.log(oclif.ux.colorize('red', `✖ ${where}: ${problem.reason}`));

        for (const suggestion of problem.suggestions ?? []) {
          this.log(oclif.ux.colorize('dim', `    ${suggestion}`));
        }
      }

      for (const error of report.typeErrors) {
        this.log(
          oclif.ux.colorize(
            'red',
            `✖ ${error.file}:${error.line}:${error.column} — TS${error.code}: ${error.message}`,
          ),
        );
      }

      if (report.outcome === 'drifted') {
        this.log();
        this.log(
          'Breaking drift: the API description no longer matches these hooks.',
        );
        this.log(
          'Fix them, run "thymian sampler sync", and commit the result.',
        );
        this.exit(1);
      }

      if (report.outcome === 'broken') {
        this.log();
        this.log(
          'These hooks do not compile against the current API description.',
        );
        // Deliberately not "run sync": the committed types already match the
        // description, so regenerating would rewrite correct files and leave
        // the real error exactly where it is.
        this.log(
          report.surface === 'absent'
            ? 'Fix them. Nothing is committed, so there is nothing to regenerate.'
            : 'Fix them. The committed types are already in sync — there is no drift to resolve.',
        );
        this.exit(1);
      }

      if (report.outcome === 'stale') {
        this.log(
          oclif.ux.colorize(
            'yellow',
            '! The committed sampler types are behind this API description, but every hook still compiles:',
          ),
        );

        for (const file of report.changedFiles) {
          this.log(oclif.ux.colorize('dim', `    generated/${file}`));
        }

        this.log();
        this.log('Run "thymian sampler sync" and commit the result.');

        return report;
      }

      this.log(
        oclif.ux.colorize(
          'green',
          report.surface === 'absent'
            ? 'Every hook resolves. Run "thymian sampler init" for editor support and a type gate.'
            : 'Every hook resolves and the committed types match this API description.',
        ),
      );

      return report;
    });
  }
}
