import { ThymianBaseError, type ThymianPlugin } from '@thymian/core';
import PQueue from 'p-queue';

import { dispatchHttpRequest } from './dispatch.js';

export interface HttpRequestError extends Error {
  code: string;
}

export function isHttpRequestError(err: unknown): err is HttpRequestError {
  return err instanceof Error && 'code' in err;
}

export type SamplerPluginOptions = {
  concurrency?: number;
};

export const dispatcherPlugin: ThymianPlugin<SamplerPluginOptions> = {
  name: '@thymian/request-dispatcher',
  version: '0.x',
  options: {
    type: 'object',
    properties: {
      concurrency: { type: 'integer', nullable: true },
    },
  },
  actions: {
    listensOn: ['core.request.dispatch'],
  },
  events: {},
  plugin: async (emitter, logger, opts) => {
    const queue = new PQueue({ concurrency: opts?.concurrency ?? 10 });

    emitter.onAction('core.close', async (_, ctx) => {
      await queue.onIdle();

      ctx.reply();
    });

    emitter.onAction(
      'core.request.dispatch',
      async ({ request, options }, ctx) => {
        try {
          const result = await queue.add(() =>
            dispatchHttpRequest(request, options),
          );

          ctx.reply(result);
        } catch (e: unknown) {
          if (isHttpRequestError(e) && e.code === 'ECONNREFUSED') {
            return ctx.error(
              new ThymianBaseError(`Server ${request.origin} is unavailable.`, {
                name: 'ServerUnavailableError',
                ref: 'https://thymian.dev/references/errors/server-unavailable-error/',
              }),
            );
          }
          ctx.error(
            new ThymianBaseError(
              `Error while dispatching request: ${request.method.toUpperCase()} ${
                request.origin
              }.`,
              {
                name: 'RequestDispatchError',
                ref: 'https://thymian.dev/references/errors/request-dispatch-error/',
                cause: e,
              },
            ),
          );
        }
      },
    );
  },
};

export * from './types.js';
export default dispatcherPlugin;
