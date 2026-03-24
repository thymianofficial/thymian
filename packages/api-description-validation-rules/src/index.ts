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
    'core.validate-api-description': {
      event: {
        format: SerializedThymianFormat;
      };
      response: boolean;
    };
  }
}

export const formatValidatorPlugin: ThymianPlugin = {
  name: '@thymian/api-description-validation-rules',
  version: '0.x',
  actions: {
    requires: ['sampler.init', 'core.request.dispatch'],
  },
  events: {
    emits: ['core.report'],
  },
  async plugin(emitter: ThymianEmitter, logger: Logger): Promise<void> {
    emitter.onAction(
      'core.validate-api-description',
      async ({ format }, ctx) => {
        const thymianFormat = ThymianFormat.import(format);
        const context = createContext(thymianFormat, logger, emitter);

        const valid = await validate(context, logger, (report) =>
          emitter.emit('core.report', report),
        );

        ctx.reply(valid);
      },
    );

    emitter.onAction('core.run', async (format, ctx) => {
      const thymianFormat = ThymianFormat.import(format);
      const context = createContext(thymianFormat, logger, emitter);

      const valid = await validate(context, logger, (report) =>
        emitter.emit('core.report', report),
      );

      ctx.reply({
        pluginName: '@thymian/api-description-validation-rules',
        status: valid ? 'success' : 'failed',
      });
    });
  },
};

export default formatValidatorPlugin;
