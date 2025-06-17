import { ThymianError, type ThymianPlugin } from '@thymian/core';
import {
  type HttpRequest,
  httpRequestSchema,
  type HttpResponse,
  httpResponseSchema,
} from './types.js';
import { dispatchHttpRequest } from './dispatch.js';

declare module '@thymian/core' {
  interface ThymianHooks {
    'request-dispatcher.http-request': {
      args: [HttpRequest];
      returnType: HttpResponse;
    };
  }
}

export const dispatcherPlugin: ThymianPlugin = {
  name: '@thymian/request-dispatcher',
  version: '0.x',
  options: {},
  hooks: {
    'request-dispatcher.http-request': {
      input: httpRequestSchema,
      output: httpResponseSchema,
    },
  },
  events: {},
  plugin: async (emitter) => {
    emitter.onHook('request-dispatcher.http-request', async (request) => {
      try {
        return await dispatchHttpRequest(request);
      } catch (e) {
        throw new ThymianError(
          `Error while dispatching request: ${request.method.toUpperCase()} ${
            request.url
          }.`,
          e
        );
      }
    });
  },
};

export * from './types.js';
export default dispatcherPlugin;
