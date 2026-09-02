import { relative } from 'node:path';

import { BaseCliRunCommand, oclif } from '@thymian/common-cli';

export default class Init extends BaseCliRunCommand<typeof Init> {
  static override enableJsonFlag = true;

  static override description =
    'Set up the sampler for editor support: generate the committed type surface and scaffold a tsconfig.';

  static override examples = ['<%= config.bin %> <%= command.id %>'];

  override async run(): Promise<unknown> {
    return this.thymian.run(async (emitter) => {
      await this.thymian.loadFormat(
        {
          inputs: this.thymianConfig.specifications ?? [],
          validateSpecs: this.flags['validate-specs'],
        },
        // The sampler builds its catalog on `core.format`, and the type surface
        // is generated from that catalog.
        { emitFormat: true },
      );

      const result = await emitter.emitAction(
        'sampler.init',
        {},
        { strategy: 'first' },
      );

      if (this.jsonEnabled()) {
        return result;
      }

      const root = relative(this.flags.cwd, result.root) || result.root;

      this.log(oclif.ux.colorize('green', `Sampler ready in ${root}.`));
      this.log();

      for (const file of result.generated) {
        this.log(`  generated/${file}`);
      }

      this.log(
        result.tsconfig === 'written'
          ? '  tsconfig.json'
          : `  tsconfig.json ${oclif.ux.colorize('dim', '(kept — yours from here on)')}`,
      );

      this.log();
      this.log('One thing left, which only you can do:');
      this.log();

      for (const line of result.rootExcludeNote) {
        this.log(`  ${line}`);
      }

      this.log();
      this.log(
        oclif.ux.colorize(
          'dim',
          'Hooks run with or without this: `thymian test` resolves @thymian/hooks itself. What init adds is autocomplete and `thymian sampler validate`.',
        ),
      );

      return result;
    });
  }
}
