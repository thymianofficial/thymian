import type { HttpRequest, HttpResponse } from '@thymian/core';
import type { FastifyInstance, InjectOptions } from 'fastify';

export function createFastifyRequestRunner(
  fastify: FastifyInstance,
): (req: HttpRequest) => Promise<HttpResponse> {
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
      headers: Object.entries(response.headers).reduce(
        (acc, [name, value]) => {
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
        },
        {} as Record<string, string>,
      ),
    };
  };
}
