import {
  type Logger,
  type SerializedThymianFormat,
  ThymianEmitter,
  ThymianFormat,
  type ThymianPlugin,
} from '@thymian/core';
import type {} from '@thymian/request-dispatcher';
import type {} from '@thymian/sampler';

import { createContext } from './create-context.js';
import { validate } from './validate.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'format-validator.validate': {
      event: {
        format: SerializedThymianFormat;
      };
      response: void;
    };
  }
}

export const formatValidatorPlugin: ThymianPlugin = {
  name: '@thymian/format-validator',
  version: '0.x',
  events: {
    emits: ['core.report'],
  },
  async plugin(emitter: ThymianEmitter, logger: Logger): Promise<void> {
    emitter.onAction('format-validator.validate', async ({ format }, ctx) => {
      const thymianFormat = ThymianFormat.import(format);
      const context = createContext(thymianFormat, logger, emitter);

      await validate(context, logger, (report) =>
        emitter.emit('core.report', report)
      );

      ctx.reply();
    });

    emitter.onAction('core.run', async (format, ctx) => {
      const thymianFormat = ThymianFormat.import(format);
      const context = createContext(thymianFormat, logger, emitter);

      const valid = await validate(context, logger, (report) =>
        emitter.emit('core.report', report)
      );

      ctx.reply({
        pluginName: '@thymian/format-validator',
        status: valid ? 'success' : 'failed',
      });
    });
  },
};

export default formatValidatorPlugin;
