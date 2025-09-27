import {
  type HttpRequest,
  type HttpResponse,
  type JSONSchemaType,
  ThymianBaseError,
  type ThymianPlugin,
} from '@thymian/core';

import {
  dispatchHttpRequest,
  type HttpRequestDispatchOptions,
} from './dispatch.js';
import { httpResponseSchema } from './types.js';

declare module '@thymian/core' {
  interface ThymianActions {
    'request-dispatcher.http-request': {
      event: {
        options?: Partial<HttpRequestDispatchOptions>;
        request: HttpRequest;
      };
      response: HttpResponse;
    };
  }
}

export const httpRequestHookSchema: JSONSchemaType<{
  options?: Partial<HttpRequestDispatchOptions>;
  request: HttpRequest;
}> = {
  type: 'object',
  nullable: false,
  required: ['request'],
  properties: {
    options: {
      type: 'object',
      nullable: true,
      properties: {
        timeout: {
          type: 'integer',
          nullable: true,
        },
      },
    },
    request: {
      type: 'object',
      properties: {
        origin: { type: 'string', nullable: false },
        path: { type: 'string', nullable: false },
        method: { type: 'string', nullable: false },
        body: { type: 'string', nullable: true },
        bodyEncoding: { type: 'string', nullable: true },
        headers: {
          type: 'object',
          required: [],
          nullable: true,
          additionalProperties: {
            oneOf: [
              {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              {
                type: 'string',
              },
            ],
          },
        },
        timeout: { type: 'number', nullable: true },
      },
      required: ['origin', 'method', 'path'],
      additionalProperties: false,
    },
  },
};

export const dispatcherPlugin: ThymianPlugin = {
  name: '@thymian/request-dispatcher',
  version: '0.x',
  actions: {
    provides: {
      'request-dispatcher.http-request': {
        event: httpRequestHookSchema,
        response: httpResponseSchema,
      },
    },
  },
  events: {},
  plugin: async (emitter) => {
    emitter.onAction(
      'request-dispatcher.http-request',
      async ({ request, options }, ctx) => {
        try {
          const result = await dispatchHttpRequest(request, options);

          ctx.reply(result);
        } catch (e) {
          ctx.error(
            new ThymianBaseError(
              `Error while dispatching request: ${request.method.toUpperCase()} ${
                request.origin
              }.`,
              { cause: e },
            ),
          );
        }
      },
    );
  },
};

export * from './types.js';
export default dispatcherPlugin;
