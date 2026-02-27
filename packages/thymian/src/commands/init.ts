import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, format, join, parse } from 'node:path';

import {
  defaultConfig,
  ThymianBaseCommand,
  type ThymianConfig,
} from '@thymian/cli-common';
import { Flags, ux } from '@thymian/cli-common/oclif';
import { stringify } from '@thymian/cli-common/yaml';
import { type Logger, TextLogger, ThymianBaseError } from '@thymian/core';

export default class Init extends ThymianBaseCommand<typeof Init> {
  static override description = 'Initialize Thymian in your project.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --yes',
    '<%= config.bin %> <%= command.id %> --yes --force',
    '<%= config.bin %> <%= command.id %> --config-file custom-config.yaml',
  ];

  static override flags = {
    ['yaml-format']: Flags.boolean({
      default: false,
      allowNo: true,
      description: 'Output configuration file in YAML format.',
    }),
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
    'config-file': Flags.string({
      default: 'thymian.config.json',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite existing configuration file.',
    }),
    yes: Flags.boolean({
      default: false,
    }),
  };

  private readonly logger: Logger = new TextLogger('@thymian/cli');
  private readonly thymianConfig: ThymianConfig = defaultConfig;

  public async run(): Promise<void> {
    const configFilePath = join(this.flags.cwd, this.flags['config-file']);

    const parsedPath = parse(configFilePath);

    const shouldBeYamlFormat =
      this.flags['yaml-format'] ||
      extname(configFilePath) === '.yaml' ||
      extname(configFilePath) === '.yml';

    if (parsedPath.ext === '.json' && shouldBeYamlFormat) {
      parsedPath.ext = '.yaml';
    } else if (
      (parsedPath.ext === '.yaml' || parsedPath.ext === '.yml') &&
      !shouldBeYamlFormat
    ) {
      parsedPath.ext = '.json';
    }

    const finalConfigFilePath = format({
      dir: parsedPath.dir,
      name: parsedPath.name,
      ext: parsedPath.ext,
      root: parsedPath.root,
    });

    if (existsSync(finalConfigFilePath) && !this.flags.force) {
      // Pre-flight check: verify config file doesn't already exist
      throw new ThymianBaseError(
        `Configuration file "${configFilePath}" already exists.`,
        {
          suggestions: [
            '`thymian init --force` to overwrite current configuration',
            '`thymian init --config-file <path>` to specify a different file path',
          ],
          name: 'ThymianConfigAlreadyExists',
        },
      );
    }

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

    for (const pluginName of Object.keys(this.thymianConfig.plugins)) {
      this.log(`${ux.colorize('cyan', 'ADDED')} plugin ${pluginName}`);
    }

    try {
      await writeFile(finalConfigFilePath, this.getConfig(shouldBeYamlFormat), {
        encoding: 'utf-8',
        flag: this.flags.force ? 'w' : 'wx',
      });
    } catch (e) {
      this.debug('Error writing configuration file: ' + e);
      this.error(`Failed to write configuration file to "${configFilePath}".`, {
        exit: 1,
      });
    }

    this.log(`${ux.colorize('green', 'CREATED')} ${configFilePath}`);
    this.log();
    this.log(`Initialized Thymian.`);
  }

  private getConfig(yaml: boolean): string {
    if (yaml) {
      return stringify(this.thymianConfig);
    } else {
      return JSON.stringify(this.thymianConfig, null, 2);
    }
  }
}
