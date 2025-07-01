import {
  ThymianError,
  type ThymianPlugin,
  type HttpResponse,
  type HttpRequest,
  type JSONSchemaType,
} from '@thymian/core';
import { httpRequestSchema, httpResponseSchema } from './types.js';
import {
  dispatchHttpRequest,
  type HttpRequestDispatchOptions,
} from './dispatch.js';

declare module '@thymian/core' {
  interface ThymianHooks {
    'request-dispatcher.http-request': {
      arg: {
        options?: Partial<HttpRequestDispatchOptions>;
        request: HttpRequest;
      };
      returnType: HttpResponse;
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
  hooks: {
    'request-dispatcher.http-request': {
      arg: httpRequestHookSchema,
      returns: httpResponseSchema,
    },
  },
  events: {},
  plugin: async (emitter) => {
    emitter.onHook(
      'request-dispatcher.http-request',
      async ({ request, options }) => {
        try {
          return await dispatchHttpRequest(request, options);
        } catch (e) {
          throw new ThymianError(
            `Error while dispatching request: ${request.method.toUpperCase()} ${
              request.origin
            }.`,
            e
          );
        }
      }
    );
  },
};

export * from './types.js';
export default dispatcherPlugin;
