import { fastifyBasicAuth } from '@fastify/basic-auth';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import todos from './todo.plugin.js';

export function buildTodosApp(
  opts: FastifyServerOptions = {}
): FastifyInstance {
  const app = Fastify(opts);

  app
    .register(fastifyBasicAuth, {
      validate: async (username, password) => {
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
