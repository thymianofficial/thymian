import { defaultConfig, type ThymianConfig } from '@thymian/cli-common';
import { Command, Flags } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';
import { type Logger, TextLogger } from '@thymian/core';

export default class Init extends Command {
  static override description = 'Initialize Thymian in your project.';
  static override examples = ['<%= config.bin %> <%= command.id %>'];

  static override flags = {
    yaml: Flags.boolean({
      default: true,
      allowNo: true,
      description: 'Output configuration file in YAML format.',
    }),
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
    // https://clig.dev/#interactivity
    'no-input': Flags.boolean({
      default: false,
      description: 'Disable interactive input.',
    }),
  };

  private readonly logger: Logger = new TextLogger('@thymian/cli');
  private readonly thymianConfig: ThymianConfig = defaultConfig;

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (flags['no-input']) {
      return this.printConfig(flags.yaml);
    }

    const hookResults = await this.config.runHook('thymian-plugin.init', {
      cwd: flags.cwd,
    });

    if (hookResults.failures.length > 0) {
      hookResults.failures.forEach((failure) => {
        this.error(failure.error);
      });
      this.exit(1);
    }

    for (const success of hookResults.successes) {
      const { configuration, pluginName, include } = success.result;

      if (include) {
        this.thymianConfig.plugins[pluginName] = configuration;
      } else {
        delete this.thymianConfig.plugins[pluginName];

        this.debug(
          `Plugin "${pluginName}" is not added to Thymian configuration.`
        );
      }
    }

    this.printConfig(flags.yaml);
  }

  private printConfig(yaml: boolean): void {
    if (yaml) {
      this.log(stringify(this.thymianConfig));
    } else {
      this.log(JSON.stringify(this.thymianConfig, null, 2));
    }
  }
}
