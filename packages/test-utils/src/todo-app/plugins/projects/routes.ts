import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import type { FastifyInstance } from 'fastify';

import { TodoSchema } from '../todos/todo.model.js';
import { ProjectSchema } from './project.model.js';

export default async function projectsRoutes(_fastify: FastifyInstance) {
  const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();

  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: ProjectSchema,
          },
        },
      },
    },
    async () => fastify.projects.getAll(),
  );

  fastify.get(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: ProjectSchema,
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const project = fastify.projects.getById(request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      return project;
    },
  );

  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name'],
        },
        response: {
          201: ProjectSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const project = fastify.projects.create(request.body);

      return reply.status(201).send(project);
    },
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const deleted = fastify.projects.deleteById(request.params.id);

      if (!deleted) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return reply.status(204).send(null);
    },
  );

  fastify.post(
    '/:id/todos',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
          required: ['title'],
        },
        response: {
          201: TodoSchema,
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const todo = fastify.todos.create({
        title: request.body.title,
        projectId: request.params.id,
      });

      return reply.status(201).send(todo);
    },
  );

  fastify.get(
    '/:id/todos',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'array',
            items: TodoSchema,
          },
        },
      },
    },
    async (request) => {
      return fastify.todos.getByProjectId(request.params.id);
    },
  );
}
