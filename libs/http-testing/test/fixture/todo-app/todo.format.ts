import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  QuerySerializationStyleBuilder,
  ThymianFormat,
} from '@thymian/core';

export const todoFormat = new ThymianFormat();

const getTodosReqId = todoFormat.addRequest({
  cookies: {},
  headers: {},
  host: 'localhost',
  mediaType: '',
  method: 'GET',
  path: '/todos',
  pathParameters: {},
  port: 8080,
  protocol: 'http',
  queryParameters: {
    title: {
      schema: { type: 'string', examples: ['code'] },
      style: new QuerySerializationStyleBuilder().build(),
      required: true,
    },
  },
  type: 'http-request',
});

const getTodosResId = todoFormat.addResponse({
  headers: {},
  mediaType: '',
  schema: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'title', 'text'],
      properties: {
        id: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        text: {
          type: 'string',
        },
      },
    },
  },
  statusCode: 200,
  type: 'http-response',
});

todoFormat.addHttpTransaction(getTodosReqId, getTodosResId);

const postTodosReqId = todoFormat.addRequest({
  cookies: {},
  headers: {},
  host: 'localhost',
  mediaType: 'application/json',
  method: 'POST',
  path: '/todos',
  pathParameters: {},
  port: 8080,
  protocol: 'http',
  queryParameters: {},
  type: 'http-request',
  body: {
    examples: [
      {
        title: 'My new todo',
        text: 'I should write more tests!',
      },
    ],
    type: 'object',
    additionalProperties: false,
    required: ['title', 'text'],
    properties: {
      title: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
    },
  },
});

const postTodosResId = todoFormat.addResponse({
  headers: {
    location: {
      required: true,
      style: DEFAULT_HEADER_SERIALIZATION_STYLE,
      schema: {
        type: 'string',
      },
    },
  },
  mediaType: 'application/json',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'title', 'text'],
    properties: {
      id: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
    },
  },
  statusCode: 201,
  type: 'http-response',
});

todoFormat.addHttpTransaction(postTodosReqId, postTodosResId);

const getSingleTodoReqId = todoFormat.addRequest({
  cookies: {},
  headers: {},
  host: 'localhost',
  mediaType: '',
  method: 'GET',
  path: '/todos/{id}',
  pathParameters: {
    title: {
      schema: { type: 'string', examples: ['1'] },
      style: new QuerySerializationStyleBuilder().build(),
      required: true,
    },
  },
  port: 8080,
  protocol: 'http',
  queryParameters: {},
  type: 'http-request',
});

const getSingleTodoResId = todoFormat.addResponse({
  headers: {},
  mediaType: 'application/json',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'title', 'text'],
    properties: {
      id: {
        type: 'string',
      },
      title: {
        type: 'string',
      },
      text: {
        type: 'string',
      },
    },
  },
  statusCode: 200,
  type: 'http-response',
});

todoFormat.addHttpTransaction(getSingleTodoReqId, getSingleTodoResId);

const basicAuthId = todoFormat.addNode({
  type: 'security-scheme',
  scheme: 'basic',
});

todoFormat.addEdge(getTodosReqId, basicAuthId, { type: 'is-secured' });
todoFormat.addEdge(postTodosReqId, basicAuthId, { type: 'is-secured' });
todoFormat.addEdge(getSingleTodoReqId, basicAuthId, { type: 'is-secured' });
