import { fastifyBasicAuth } from '@fastify/basic-auth';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import todos from './todo.plugin.js';
import fastifySwagger from '@fastify/swagger';

export function buildTodosApp(
  opts: FastifyServerOptions = { ignoreTrailingSlash: true }
): FastifyInstance {
  const app = Fastify(opts);

  app
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
        console.log({ username, password });
        if (!(username === 'matthyk' && password === 'qupaya')) {
          throw new Error('Wrong username or password.');
        }
      },
    })
    .after(() => {
      app.addHook('onRequest', app.basicAuth);

      app.register(todos, {
        prefix: '/todos',
      });
    });

  return app;
}
