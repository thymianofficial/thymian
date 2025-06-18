import type { FastifyInstance } from 'fastify';
import type { InjectOptions } from 'light-my-request';

import type { HttpTestContext } from '../src/http-test-context.js';
import type { HttpRequest } from '../src/http-request';

export const exampleContentGenerator: HttpTestContext['generateContent'] =
  async (schema) => {
    if (typeof schema === 'boolean') {
      return { content: {} };
    } else {
      return { content: schema.examples?.[0] };
    }
  };

export const identityHookRunner: HttpTestContext['runHook'] = async <
  Input,
  Output
>(
  _: string,
  x: Input
) => x as unknown as Output;

export function createRequestRunner(
  fastify: FastifyInstance
): HttpTestContext['runRequest'] {
  return async (req: HttpRequest) => {
    const response = await fastify.inject({
      url: req.origin + req.path,
      headers: req.headers,
      method: req.method as InjectOptions['method'],
      body: req.body,
    });

    return {
      statusCode: response.statusCode,
      duration: 0,
      body: response.payload,
      trailers: {},
      headers: Object.entries(response.headers).reduce((acc, [name, value]) => {
        if (Array.isArray(value)) {
          return {
            ...acc,
            [name]: value.join(', '),
          };
        } else if (typeof value === 'string' || typeof value === 'number') {
          return {
            ...acc,
            [name]: String(value),
          };
        } else {
          return acc;
        }
      }, {} as Record<string, string>),
    };
  };
}
