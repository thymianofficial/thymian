import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import type { FastifyInstance } from 'fastify';
import etag from 'etag';

export interface Todo {
  id: string;
  title: string;
  text: string;
}

export default function todos(_fastify: FastifyInstance) {
  const todos: Todo[] = [
    {
      id: '1',
      title: 'Grocery shopping',
      text: 'Buy milk, bread, eggs, and cheese.',
    },
    { id: '2', title: 'Workout', text: 'Go for a 30-minute run in the park.' },
    {
      id: '3',
      title: 'Read a book',
      text: "Finish chapters 4 and 5 of 'Clean Code'.",
    },
    {
      id: '4',
      title: 'Project meeting',
      text: 'Join the Zoom call with the team at 10:00 AM.',
    },
    { id: '5', title: 'Pay bill', text: 'Pay the electricity bill online.' },
    {
      id: '6',
      title: 'Wash the car',
      text: 'Clean the interior and exterior of the car.',
    },
    {
      id: '7',
      title: 'Write blog post',
      text: 'Draft the next article for the blog.',
    },
    {
      id: '8',
      title: 'Buy birthday gift',
      text: 'Find a present idea for Alex.',
    },
    { id: '9', title: 'Check emails', text: 'Go through all unread emails.' },
    { id: '10', title: 'Do laundry', text: 'Wash the colored clothes.' },
    {
      id: '11',
      title: 'Sort tax documents',
      text: 'Prepare all receipts for the tax return.',
    },
    {
      id: '12',
      title: 'Go for a walk',
      text: 'Get some fresh air for 15 minutes.',
    },
    {
      id: '13',
      title: 'Code review',
      text: 'Review open pull requests in the repo.',
    },
    {
      id: '14',
      title: 'Review GitHub issues',
      text: 'Analyze open bugs and feature requests.',
    },
    {
      id: '15',
      title: 'Update resume',
      text: 'Add recent projects and skills.',
    },
    {
      id: '16',
      title: 'Book a trip',
      text: 'Reserve flights and accommodation for summer.',
    },
    {
      id: '17',
      title: 'Organize paperwork',
      text: 'File insurance documents properly.',
    },
    {
      id: '18',
      title: 'Take online course',
      text: "Complete module 2 of 'TypeScript Deep Dive'.",
    },
    { id: '19', title: 'Clean up room', text: 'Tidy up desk and shelves.' },
    {
      id: '20',
      title: 'Update to-do list',
      text: 'Remove old tasks and add new ones.',
    },
  ];

  const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();

  // should send validator field
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['title'],
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
            },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, res) => {
      res.code(200);

      return todos.filter((todo) =>
        todo.title.toLowerCase().includes(req.query.title.toLowerCase())
      );
    }
  );

  fastify.get(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
          },
        },
      },
    },
    async (req, res) => {
      const todo = todos.find((todo) => todo.id === req.params.id);

      if (!todo) {
        res.status(404);

        return;
      }
      console.log({ etag: etag(JSON.stringify(todo)) });
      res.header('etag', etag(JSON.stringify(todo)));
      return todo;
    }
  );

  fastify.post(
    '/',
    {
      schema: {
        security: [{ basicAuth: [] }],
        body: {
          type: 'object',
          required: ['title', 'text'],
          additionalProperties: false,
          properties: {
            text: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
          },
        },
      },
    },
    async (req, reply) => {
      const todo: Todo = {
        ...req.body,
        id: todos.length.toString(),
      };

      todos.push(todo);

      reply.header('location', '/todos/' + todo.id);
      reply.status(201);

      return todo;
    }
  );
}

export const autoPrefix = '/todos';
