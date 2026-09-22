import { join, relative } from 'node:path';

import { BaseCliRunCommand, oclif } from '@thymian/common-cli';

const { colorize } = oclif.ux;

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

      for (const file of result.generated) {
        this.log(`${colorize('green', 'created')} ${join(root, file)}`);
      }

      if (result.tsconfig === 'written') {
        this.log(
          `${colorize('green', 'created')} ${join(root, 'tsconfig.json')}`,
        );
      }

      if (result.rootExcludeNote.length > 0) {
        this.log();
        this.log('One thing left, which only you can do:');
        this.log();

        for (const line of result.rootExcludeNote) {
          this.log(`  ${line}`);
        }
      }

      return result;
    });
  }
}
