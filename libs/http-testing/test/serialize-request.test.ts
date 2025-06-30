import {
  DEFAULT_PATH_SERIALIZATION_STYLE,
  QuerySerializationStyleBuilder,
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
        },
        thymianReqId: '',
        thymianRes: {
          type: 'http-response',
          headers: {},
          mediaType: '',
          statusCode: 0,
          schema: {},
        },
        thymianResId: '',
        transactionId: '',
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
});
