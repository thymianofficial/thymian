import type { FastifyInstance } from 'fastify';

export default async function resetContent(fastify: FastifyInstance) {
  fastify.post(
    '/valid',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
            },
          },
        },
      },
    },
    (req, reply) => {
      return reply.status(205).send();
    }
  );

  // response body must be empty
  fastify.post(
    '/invalid',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
            },
          },
        },
      },
    },
    (req, reply) => {
      return reply.status(205).send(req.body);
    }
  );
}

export const autoPrefix = '/reset-content';
