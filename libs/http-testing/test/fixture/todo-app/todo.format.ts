import {
  ArraySchema,
  ObjectSchema,
  QuerySerializationStyle,
  StringSchema,
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
      schema: new StringSchema().withExample('code'),
      style: new QuerySerializationStyle(),
      required: true,
    },
  },
  type: 'http-request',
});

const getTodosResId = todoFormat.addResponse({
  headers: {},
  mediaType: '',
  schema: new ArraySchema().withItems(
    new ObjectSchema()
      .withProperty('id', new StringSchema())
      .withProperty('title', new StringSchema())
      .withProperty('text', new StringSchema())
  ),
  statusCode: 200,
  type: 'http-response',
});

todoFormat.addHttpTransaction(getTodosReqId, getTodosResId);

const basicAuthId = todoFormat.addNode({
  type: 'security-scheme',
  scheme: 'basic',
});

todoFormat.addEdge(getTodosReqId, basicAuthId, { type: 'is-secured' });
