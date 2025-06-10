import {
  PathSerializationStyle,
  QuerySerializationStyle,
  ThymianSchema,
} from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { serializeRequest } from '../src/serialize-request.js';

describe('serializeRequest', () => {
  it('should serialize request with source', () => {
    const req = serializeRequest({
      request: {
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
              schema: new ThymianSchema(),
              style: new QuerySerializationStyle()
                .withStyle('spaceDelimited')
                .withExplode(true),
            },
          },
          cookies: {},
          pathParameters: {
            userId: {
              required: false,
              schema: new ThymianSchema(),
              style: new PathSerializationStyle(),
            },
          },
          bodyRequired: false,
          body: new ThymianSchema(),
          mediaType: '',
        },
        thymianReqId: '',
        thymianRes: {
          type: 'http-response',
          headers: {},
          mediaType: '',
          statusCode: 0,
          schema: new ThymianSchema(),
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
