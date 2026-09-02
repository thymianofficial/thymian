import { BaseCliRunCommand, oclif } from '@thymian/common-cli';
import { Args } from '@thymian/common-cli/oclif';

export default class Show extends BaseCliRunCommand<typeof Show> {
  static override enableJsonFlag = true;

  static override description =
    'Print the freshly generated request for one transaction selector.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> "GET /launches -> 200 (application/json)"',
    '<%= config.bin %> <%= command.id %> "DELETE /astronauts/{id} -> 204" --json',
  ];

  static override args = {
    selector: Args.string({
      required: true,
      description:
        'The transaction selector, as METHOD path [(requestMediaType)] -> status [(responseMediaType)].',
    }),
  };

  override async run(): Promise<unknown> {
    return this.thymian.run(async (emitter) => {
      await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        // The sampler answers from the projection it builds on `core.format`,
        // so the format has to reach it before the selector is resolved.
        { emitFormat: true },
      );

      const shown = await emitter.emitAction(
        'sampler.show',
        { selector: this.args.selector },
        { strategy: 'first' },
      );

      if (this.jsonEnabled()) {
        return shown;
      }

      this.log(oclif.ux.colorize('bold', shown.selector));
      this.log();
      this.log(JSON.stringify(shown.request, null, 2));

      return shown;
    });
  }
}
