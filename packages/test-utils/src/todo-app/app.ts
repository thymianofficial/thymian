import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyAutoload from '@fastify/autoload';
import fastifySwagger from '@fastify/swagger';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

import type { ProjectRepository } from './plugins/projects/projects.repository.js';
import type { TodoRepository } from './plugins/todos/todo.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

declare module 'fastify' {
  interface FastifyInstance {
    projects: ProjectRepository;
    todos: TodoRepository;
  }
}

export async function buildToDoApp(
  opts: FastifyServerOptions = {
    ignoreTrailingSlash: true,
    logger: {
      level: 'error',
    },
  },
): Promise<FastifyInstance> {
  const app = Fastify(opts);

  await app.register(fastifyAutoload, {
    dir: path.join(__dirname, 'plugins'),
    ignorePattern: /^.*\.model.ts$/,
    dirNameRoutePrefix: true,
  });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Test Todo Project',
        version: '0.0.1',
      },
      servers: [
        {
          url: 'http://localhost:3000',
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
  });

  await app.register(import('@fastify/swagger-ui'), {
    logLevel: 'trace',
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  return app;
}
