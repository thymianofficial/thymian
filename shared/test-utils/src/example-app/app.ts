import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyAutoload from '@fastify/autoload';
import { fastifyBasicAuth } from '@fastify/basic-auth';
import fastifySwagger from '@fastify/swagger';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
// there are not type definitions for this package
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import fastifyRange from 'fastify-range';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

declare module 'fastify' {
  interface FastifyRequest {
    range(size: number):
      | undefined
      | {
          unit: 'bytes' | (string & {});
          ranges: { start: number; end: number }[];
        };
  }
}

export function buildExampleApp(
  opts: FastifyServerOptions = { ignoreTrailingSlash: true }
): FastifyInstance {
  return Fastify(opts)
    .register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Test Fastify Project',
          version: '0.0.1',
        },
        servers: [
          {
            url: 'http://localhost:8080',
            description: 'Development server',
          },
        ],
        tags: [],
        components: {
          securitySchemes: {
            basicAuth: {
              type: 'http',
              scheme: 'basic',
            },
          },
        },
      },
    })
    .register(fastifyBasicAuth, {
      validate: async (username, password) => {
        if (!(username === 'matthyk' && password === 'qupaya')) {
          throw new Error('Wrong username or password.');
        }
      },
    })
    .register(fastifyRange)
    .register(fastifyAutoload, {
      dir: path.join(__dirname, 'plugins'),
    });
}
