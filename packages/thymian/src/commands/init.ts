import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  defaultConfig,
  ThymianBaseCommand,
  type ThymianConfig,
} from '@thymian/cli-common';
import { Flags } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';
import { type Logger, TextLogger } from '@thymian/core';

export default class Init extends ThymianBaseCommand<typeof Init> {
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
    'config-file': Flags.string({
      default: 'thymian.config',
    }),
    yes: Flags.boolean({
      default: false,
    }),
  };

  private readonly logger: Logger = new TextLogger('@thymian/cli');
  private readonly thymianConfig: ThymianConfig = defaultConfig;

  public async run(): Promise<void> {
    const hookResults = await this.config.runHook('thymian-plugin.init', {
      cwd: this.flags.cwd,
      interactive: !this.flags.yes,
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
          `Plugin "${pluginName}" is not added to Thymian configuration.`,
        );
      }
    }

    const configFilePath = join(
      this.flags.cwd,
      `${this.flags['config-file']}${this.flags.yaml ? '.yaml' : '.json'}`,
    );

    try {
      await writeFile(configFilePath, this.getConfig(this.flags.yaml), {
        encoding: 'utf-8',
        flag: 'wx',
      });
    } catch (e) {
      this.debug('Error writing configuration file: ' + e);
      this.error(
        `Configuration file "${configFilePath}" already exists. Please remove it before initializing Thymian.`,
        { exit: 1 },
      );
    }

    this.debug('Created configuration file at: ' + configFilePath);

    this.log(`Initialized Thymian.`);
  }

  private printConfig(yaml: boolean): void {
    this.log(this.getConfig(yaml));
  }

  private getConfig(yaml: boolean): string {
    if (yaml) {
      return stringify(this.thymianConfig);
    } else {
      return JSON.stringify(this.thymianConfig, null, 2);
    }
  }
}
