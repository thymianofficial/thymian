import { Args, Flags } from '@oclif/core';
import {
  type SerializedThymianFormat,
  TextLogger,
  Thymian,
  ThymianCommand,
  ThymianFormat,
} from '@thymian/core';
import openApiPlugin from '@thymian/openapi';

import { BaseCliCommand } from '../base-cli-command.js';

export class ThymianLoadCommand extends ThymianCommand<SerializedThymianFormat> {
  override async run(): Promise<SerializedThymianFormat> {
    const formats = await this.emitter.runHook('core.load-format');

    return formats[1]!;
  }
}

export default class Load extends BaseCliCommand<typeof Load> {
  static override args = {
    file: Args.string({ description: 'file to read', required: true }),
  };
  static override description =
    'Load and parse the given formats to the Thymian format.';
  static override examples = [
    '<%= config.bin %> <%= command.id %> openapi.yaml',
  ];
  static override flags = {};

  public async run(): Promise<void> {
    const thymian = new Thymian(this.logger.child('Thymian'));

    thymian.register(openApiPlugin, {
      filePath: this.args.file,
    });

    try {
      const result = await thymian.run(ThymianLoadCommand);
      this.log(JSON.stringify(result, null, 2));
    } catch (e) {
      this.exit(1);
    }

    this.logger.warn('This is a warning.');
    this.logger.error('This is a warning.');
    this.logger.trace('This is a warning.');
  }
}
