import type { ThymianHttpTransaction } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { samplesTreeFromThymianHttpTransaction } from '../src/generation/create-path-for-transaction.js';
import type { HttpRequestSample } from '../src/http-request-sample.js';
import type { SamplesStructure } from '../src/samples-structure/samples-tree-structure.js';

describe('samplesTreeFromThymianHttpTransaction', () => {
  const sample: HttpRequestSample = {
    origin: 'http://example.com',
    path: '/users/{userId}/posts',
    method: 'GET',
    authorize: true,
    headers: {},
    cookies: {},
    pathParameters: { userId: { $content: 'url' } },
    query: { filter: { $content: 'query' } },
    body: undefined,
  };

  const transaction: ThymianHttpTransaction = {
    thymianReq: {
      host: 'http://example.com',
      path: '/users/{userId}/posts',
      method: 'GET',
      mediaType: '',
      headers: {},
      queryParameters: {},
      pathParameters: {
        userId: {
          required: false,
          schema: { type: 'string' },
          style: {
            explode: false,
            style: 'matrix',
          },
        },
      },
      cookies: {},
      type: 'http-request',
      port: 0,
      protocol: 'http',
      label: '',
    },
    thymianReqId: 'req-id-1',
    thymianRes: {
      statusCode: 200,
      mediaType: 'application/json',
      headers: {},
      type: 'http-response',
      label: '',
    },
    thymianResId: 'res-id-1',
    transactionId: 'trx-123',
    transaction: {
      type: 'http-transaction',
      label: '',
    },
  };

  const version = '1.0.0';

  it('should create a valid SamplesTree structure', () => {
    const result: SamplesStructure = samplesTreeFromThymianHttpTransaction(
      sample,
      transaction,
      version,
    );

    expect(result).toEqual({
      type: 'root',
      meta: {
        version,
      },
      children: [
        {
          type: 'host',
          host: 'example.com',
          children: [
            {
              type: 'port',
              port: NaN, // Since no port is included in the origin, it's undefined
              children: [
                {
                  type: 'path',
                  path: 'users',
                  children: [
                    {
                      type: 'pathParameter',
                      name: 'userId',
                      children: [
                        {
                          type: 'path',
                          path: 'posts',
                          children: [
                            {
                              type: 'method',
                              method: 'get',
                              children: [
                                {
                                  type: 'requestMediaType',
                                  mediaType: 'application/json',
                                  children: [
                                    {
                                      type: 'statusCode',
                                      statusCode: 200,
                                      children: [
                                        {
                                          type: 'responseMediaType',
                                          mediaType: 'application/json',
                                          child: {
                                            type: 'samples',
                                            meta: {
                                              sourceTransaction: 'trx-123',
                                            },
                                            children: [
                                              {
                                                type: 'requestSample',
                                                sample,
                                              },
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should throw an error if no path nodes are created', () => {
    const invalidTransaction = {
      ...transaction,
      thymianReq: { ...transaction.thymianReq, path: '' },
    };
    expect(() =>
      samplesTreeFromThymianHttpTransaction(
        sample,
        invalidTransaction,
        version,
      ),
    ).toThrow();
  });

  it('should handle transactions without request media type', () => {
    const modifiedTransaction = {
      ...transaction,
      thymianReq: { ...transaction.thymianReq, mediaType: undefined },
    };

    const result: SamplesStructure = samplesTreeFromThymianHttpTransaction(
      sample,
      modifiedTransaction,
      version,
    );

    expect(
      result.children[0].children[0].children[0].children[0].children[0]
        .children[0],
    ).toEqual(
      expect.objectContaining({
        type: 'statusCode',
        statusCode: 200,
      }),
    );
  });

  it('should handle transactions without response media type', () => {
    const modifiedTransaction = {
      ...transaction,
      thymianRes: { ...transaction.thymianRes, mediaType: undefined },
    };

    const result: SamplesStructure = samplesTreeFromThymianHttpTransaction(
      sample,
      modifiedTransaction,
      version,
    );

    expect(
      result.children[0].children[0].children[0].children[0].children[0]
        .children,
    ).toEqual([
      {
        type: 'statusCode',
        statusCode: 200,
        children: [
          {
            type: 'samples',
            meta: { sourceTransaction: 'trx-123' },
            children: [{ type: 'requestSample', sample }],
          },
        ],
      },
    ]);
  });
});
