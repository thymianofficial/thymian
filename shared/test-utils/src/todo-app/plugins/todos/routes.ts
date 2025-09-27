import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import type { FastifyInstance } from 'fastify';

import { TodoSchema } from './todo.model.js';

export default async function todosRoutes(_fastify: FastifyInstance) {
  const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();

  fastify.get(
    '/',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: TodoSchema,
          },
        },
      },
    },
    async () => fastify.todos.getAll(),
  );

  fastify.get(
    '/:id',
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
          200: TodoSchema,
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const todo = fastify.todos.getById(request.params.id);
      if (!todo) return reply.status(404).send({ error: 'ToDo not found' });
      return todo;
    },
  );

  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
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
      const todo = fastify.todos.create(request.body);

      return reply.status(201).send(todo);
    },
  );

  fastify.put(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            done: { type: 'boolean' },
            projectId: { type: 'string' },
          },
          additionalProperties: false,
        },
        response: {
          200: TodoSchema,
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const todo = fastify.todos.getById(request.params.id);
      if (!todo) return reply.status(404).send({ error: 'ToDo not found' });

      const { projectId } = request.body;

      if (projectId && !fastify.projects.exists(projectId)) {
        return reply.status(400).send({ error: 'Invalid projectId' });
      }

      const updatedTodo = {
        ...todo,
        ...request.body,
      };

      const success = fastify.todos.update(updatedTodo);

      if (!success) {
        return reply.status(404).send({ error: 'ToDo not found' });
      }

      return todo;
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
      const success = fastify.todos.deleteById(request.params.id);

      if (!success) return reply.status(404).send({ error: 'ToDo not found' });

      return reply.status(204).send();
    },
  );
}
