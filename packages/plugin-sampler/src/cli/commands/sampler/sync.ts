import { BaseCliRunCommand, oclif } from '@thymian/common-cli';
import { Flags } from '@thymian/common-cli/oclif';

export default class Sync extends BaseCliRunCommand<typeof Sync> {
  static override enableJsonFlag = true;

  static override description =
    'Regenerate the committed sampler types from the current API description.';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --check',
  ];

  static override flags = {
    check: Flags.boolean({
      default: false,
      description:
        'Report whether regeneration would change the committed types, and write nothing. Exits non-zero if it would.',
    }),
  };

  override async run(): Promise<unknown> {
    return this.thymian.run(async (emitter) => {
      await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        { emitFormat: true },
      );

      const result = await emitter.emitAction(
        'sampler.sync',
        { check: this.flags.check },
        { strategy: 'first' },
      );

      if (this.jsonEnabled()) {
        if (this.flags.check && result.changed.length > 0) {
          process.exitCode = 1;
        }

        return result;
      }

      if (result.changed.length === 0) {
        this.log(
          oclif.ux.colorize(
            'green',
            'The committed sampler types match this API description.',
          ),
        );

        // The types matched but the bytes moved — a description edit rewrites a
        // JSDoc comment without moving a type. Saying so is the difference
        // between an explained diff and a mysterious one.
        if (result.rewritten && result.rewritten.length > 0) {
          this.log();
          this.log(
            oclif.ux.colorize(
              'dim',
              'Rewritten anyway, with no change to any type — commit or discard as you like:',
            ),
          );

          for (const file of result.rewritten) {
            this.log(oclif.ux.colorize('dim', `  generated/${file}`));
          }
        }

        return result;
      }

      if (this.flags.check) {
        this.log(
          oclif.ux.colorize(
            'red',
            `The committed sampler types are out of sync with this API description:`,
          ),
        );

        for (const file of result.changed) {
          this.log(`  generated/${file}`);
        }

        this.log();
        this.log('Run "thymian sampler sync" and commit the result.');
        this.exit(1);
      }

      this.log(oclif.ux.colorize('green', 'Regenerated:'));

      for (const file of result.changed) {
        this.log(`  generated/${file}`);
      }

      this.log();
      this.log(
        oclif.ux.colorize(
          'dim',
          'Commit these: they are the baseline the drift gate compares against.',
        ),
      );

      return result;
    });
  }
}
