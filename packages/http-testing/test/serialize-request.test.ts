import {
  DEFAULT_PATH_SERIALIZATION_STYLE,
  HttpRequestTemplate,
  QuerySerializationStyleBuilder,
  type ThymianHttpTransaction,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { serializeRequest } from '../src/serialize-request.js';

describe('serializeRequest', () => {
  it('should serialize request with source', () => {
    const req = serializeRequest({
      requestTemplate: {
        origin: 'http://localhost:8080',
        path: '/users/{userId}/posts',
        pathParameters: {
          userId: 436,
        },
        method: 'GET',
        query: {
          title: ['first', 'second'],
        },
        headers: {},
        cookies: {},
        authorize: true,
      },
      source: {
        thymianReq: {
          type: 'http-request',
          host: '',
          port: 0,
          protocol: 'http',
          path: '',
          method: '',
          headers: {},
          queryParameters: {
            title: {
              required: false,
              schema: {},
              style: new QuerySerializationStyleBuilder()
                .withStyle('spaceDelimited')
                .withExplode(true)
                .build(),
            },
          },
          cookies: {},
          pathParameters: {
            userId: {
              required: false,
              schema: {},
              style: DEFAULT_PATH_SERIALIZATION_STYLE,
            },
          },
          bodyRequired: false,
          body: {},
          mediaType: '',
          label: '',
          sourceName: '',
        },
        thymianReqId: '',
        thymianRes: {
          type: 'http-response',
          headers: {},
          mediaType: '',
          statusCode: 0,
          schema: {},
          label: '',
          sourceName: '',
        },
        thymianResId: '',
        transactionId: '',
        transaction: undefined,
      },
    });

    expect(req).toStrictEqual({
      origin: 'http://localhost:8080',
      path: '/users/436/posts?title=first&title=second',
      method: 'GET',
      bodyEncoding: undefined,
      body: undefined,
      headers: {},
    });
  });

  it('test', () => {
    const template: HttpRequestTemplate = {
      authorize: false,
      cookies: {},
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic M0RYdkNRM2NQWlFKVXJaOkw1RGl2NjQ4Y01JRHNVaQ==',
      },
      method: 'POST',
      origin: 'http://127.0.0.1:3000',
      path: '/todos/%7BtodoId%7D/tasks',
      pathParameters: { todoId: 198918 },
      query: {},
      body: { title: 'tK5YxB3vQD' },
    };

    const source: ThymianHttpTransaction = {
      thymianReq: {
        type: 'http-request',
        host: '',
        port: 0,
        protocol: 'http',
        path: '',
        method: '',
        headers: {},
        queryParameters: {
          title: {
            required: false,
            schema: {},
            style: new QuerySerializationStyleBuilder()
              .withStyle('spaceDelimited')
              .withExplode(true)
              .build(),
          },
        },
        cookies: {},
        pathParameters: {
          todoId: {
            required: false,
            schema: {},
            style: DEFAULT_PATH_SERIALIZATION_STYLE,
          },
        },
        bodyRequired: false,
        body: {},
        mediaType: '',
        label: '',
        sourceName: '',
      },
      thymianReqId: '',
      thymianRes: {
        type: 'http-response',
        headers: {},
        mediaType: '',
        statusCode: 0,
        schema: {},
        label: '',
        sourceName: '',
      },
      thymianResId: '',
      transactionId: '',
      transaction: undefined,
    };

    console.log(serializeRequest({ requestTemplate: template, source }));
  });
});
