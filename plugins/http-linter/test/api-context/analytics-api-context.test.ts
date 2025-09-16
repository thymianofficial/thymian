import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  NoopLogger,
  ThymianFormat,
} from '@thymian/core';
import {
  and,
  method,
  not,
  or,
  responseHeader,
  statusCode,
} from '@thymian/http-filter';
import { beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsApiContext } from '../../src/api-context/analytics-api-context/analytics-api-context.js';
import { HttpTransactionRepository } from '../../src/db/http-transaction-repository.js';

describe('AnalyticsApiContext', () => {
  let repo!: HttpTransactionRepository;
  const logger = new NoopLogger();
  let format = new ThymianFormat();
  let transactions!: [
    [string, string, string],
    [string, string, string],
    [string, string, string]
  ];

  beforeEach(async () => {
    repo = new HttpTransactionRepository(':memory:', logger);

    await repo.init();

    const seed = await readFile(join(import.meta.dirname, 'seed.sql'), 'utf-8');

    repo.db.exec(seed);

    format = new ThymianFormat();

    transactions = [
      format.addHttpTransaction(
        {
          mediaType: '',
          type: 'http-request',
          method: 'HEAD',
          protocol: 'https',
          port: 443,
          host: 'api.example.com',
          path: '/users',
          headers: {},
          cookies: {},
          pathParameters: {},
          queryParameters: {},
        },
        {
          headers: {
            'content-type': {
              required: true,
              schema: {
                type: 'string',
              },
              style: DEFAULT_HEADER_SERIALIZATION_STYLE,
            },
          },
          mediaType: 'application/json',
          statusCode: 200,
          type: 'http-response',
        }
      ),
      format.addHttpTransaction(
        {
          mediaType: '',
          type: 'http-request',
          method: 'HEAD',
          protocol: 'https',
          port: 443,
          host: 'api.example.com',
          path: '/search',
          headers: {},
          cookies: {},
          pathParameters: {},
          queryParameters: {},
        },
        {
          headers: {
            'content-type': {
              required: true,
              schema: {
                type: 'string',
              },
              style: DEFAULT_HEADER_SERIALIZATION_STYLE,
            },
          },
          mediaType: 'application/json',
          statusCode: 200,
          type: 'http-response',
        }
      ),
      format.addHttpTransaction(
        {
          mediaType: '',
          type: 'http-request',
          method: 'GET',
          protocol: 'https',
          port: 443,
          host: 'api.example.com',
          path: '/status',
          headers: {},
          cookies: {},
          pathParameters: {},
          queryParameters: {},
        },
        {
          headers: {
            'content-type': {
              required: true,
              schema: {
                type: 'string',
              },
              style: DEFAULT_HEADER_SERIALIZATION_STYLE,
            },
          },
          mediaType: 'application/json',
          statusCode: 200,
          type: 'http-response',
        }
      ),
    ];
  });

  it('validateCommonHttpTransactions', async () => {
    const analytics = new AnalyticsApiContext(repo, logger, format);

    const results = analytics.validateCommonHttpTransactions(
      and(or(method('get'), method('head')), statusCode(200)),
      not(or(responseHeader('etag'), responseHeader('last-modified')))
    );

    expect(results).toHaveLength(1);
    expect(results).toMatchObject([
      {
        location: {
          elementType: 'edge',
          elementId: transactions[2][2],
          pointer: '',
        },
      },
    ]);
  });

  it('validateGroupedCommonHttpTransactions', () => {
    const analytics = new AnalyticsApiContext(repo, logger, format);

    const results = analytics.validateGroupedCommonHttpTransactions(
      and(or(method('get'), method('head')), statusCode(200)),
      method(),
      (key, group) => {
        if (group.every((e) => e[0].method === 'GET')) {
          return {
            location: {
              elementType: 'edge' as const,
              elementId: '',
            },
          };
        }
      }
    );

    expect(results).toHaveLength(1);
  });
});
