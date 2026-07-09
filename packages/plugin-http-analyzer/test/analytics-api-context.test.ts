import {
  and,
  type CapturedTransaction,
  httpTransactionToLabel,
  method,
  NoopLogger,
  not,
  origin,
  path,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormat,
} from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsApiContext } from '../src/analytics-api-context.js';
import { SqliteHttpTransactionRepository } from '../src/db/sqlite-http-transaction-repository.js';

describe('AnalyticsApiContext', () => {
  let repository: SqliteHttpTransactionRepository;
  const logger = new NoopLogger();

  beforeEach(async () => {
    repository = new SqliteHttpTransactionRepository(':memory:', logger);
    await repository.init();
  });

  afterEach(async () => {
    await repository.close();
  });

  function insertTransaction(
    transaction: Partial<CapturedTransaction> = {},
  ): number {
    const defaultTransaction: CapturedTransaction = {
      request: {
        data: {
          method: 'get',
          origin: 'https://api.example.com',
          path: '/users',
          headers: {},
        },
        meta: {},
      },
      response: {
        data: {
          statusCode: 200,
          headers: {},
          trailers: {},
          duration: 100,
        },
        meta: {},
      },
      ...transaction,
    };

    return repository.insertHttpTransaction(defaultTransaction);
  }

  describe('validateCommonHttpTransactions', () => {
    it('should return violations when filter and validation match', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        not(responseHeader('content-type')),
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no transactions match filter', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(statusCode(404));

      expect(result).toHaveLength(0);
    });

    it('should support custom validation function', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        (req, res, location) => {
          if (res.statusCode === 200) {
            return [{ location, violation: {}, findings: [] }];
          }
          return [];
        },
      );

      expect(result).toHaveLength(1);
    });

    it('should support validation function returning violation object', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        (req, res, location) => [
          {
            location,
            violation: { message: 'Custom violation' },
            findings: [],
          },
        ],
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            violation: { message: 'Custom violation' },
          }),
        ]),
      );
    });

    it('should ignore skipped origins', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.de',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        () => undefined,
        [],
        ['*.example.de'],
      );

      const result = context.validateCommonHttpTransactions(statusCode(200));

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringMatching('https://api.example.com/posts'),
          }),
        ]),
      );
    });

    it('should handle multiple transactions', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/comments',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            trailers: {},
            duration: 120,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        not(responseHeader('content-type')),
      );

      expect(result).toHaveLength(2);
    });

    it('should filter by method and status code', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'post',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        and(method('get'), statusCode(200)),
      );

      expect(result).toHaveLength(1);
    });

    it('should filter by role when provided', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const contextWithRole = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['client'],
      );

      const result = contextWithRole.validateCommonHttpTransactions(
        statusCode(200),
      );

      expect(result).toHaveLength(1);
    });

    it('should support multiple roles', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {
            role: 'origin server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/comments',
            headers: {},
          },
          meta: {
            role: 'gateway',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 120,
          },
          meta: {
            role: 'server',
          },
        },
      });

      const format = createThymianFormat();
      const contextWithRoles = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['client', 'proxy'],
      );

      const result = contextWithRoles.validateCommonHttpTransactions(
        statusCode(200),
      );

      expect(result).toHaveLength(2);
    });

    it('should apply intermediate role correctly', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'user-agent',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'proxy',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'post',
            origin: 'https://api.example.de',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'user-agent',
          },
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        () => undefined,
        ['intermediary'],
      );

      const result = await context.validateCommonHttpTransactions(
        path('/users'),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringMatching('https://api.example.com/users'),
          }),
        ]),
      );
    });

    it('should match all server-side participant roles for the server role', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'user-agent',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'origin server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.de',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'gateway',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'cache',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.org',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'user-agent',
          },
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['server'],
      );

      const result = await context.validateCommonHttpTransactions(
        path('/users'),
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringMatching('https://api.example.com/users'),
          }),
          expect.objectContaining({
            location: expect.stringMatching('https://api.example.de/users'),
          }),
        ]),
      );
    });

    it('should match user-agent requests for the client role', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'user-agent',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'origin server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.de',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['client'],
      );

      const result = await context.validateCommonHttpTransactions(
        path('/users'),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringMatching('https://api.example.com/users'),
          }),
        ]),
      );
    });
  });

  describe('validateCapturedHttpTransactions', () => {
    it('should validate captured transactions with filter', () => {
      insertTransaction({
        request: {
          data: {
            method: 'post',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/products',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 50,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCapturedHttpTransactions(
        path('/users'),
        (transaction, location) => {
          if (transaction.request.data.method === 'post') {
            return [
              {
                location,
                violation: { message: 'POST method found' },
                findings: [],
              },
            ];
          }
          return [];
        },
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            violation: { message: 'POST method found' },
            location: expect.stringContaining('/users'),
          }),
        ]),
      );
    });

    it('should return violation for non-empty violation result', () => {
      insertTransaction();

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCapturedHttpTransactions(
        path('/users'),
        (transaction, location) => [{ location, violation: {}, findings: [] }],
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringContaining(''),
          }),
        ]),
      );
    });

    it('should filter by role when provided', () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'proxy',
          },
        },
      });

      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'user-agent',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        () => undefined,
        ['intermediary'],
      );

      const result = context.validateCapturedHttpTransactions(
        path('/users'),
        (transaction, location) => [{ location, violation: {}, findings: [] }],
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('validateGroupedCommonHttpTransactions', () => {
    it('should group transactions by status code', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {},
        },
      });
      insertTransaction({
        response: {
          data: {
            statusCode: 404,
            headers: {},
            trailers: {},
            duration: 50,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const groupKeys: string[] = [];
      const result = context.validateGroupedCommonHttpTransactions(
        method('get'),
        statusCode(),
        (key) => {
          groupKeys.push(key);
          return [];
        },
      );

      expect(groupKeys).toContain(200);
      expect(groupKeys).toContain(404);
      expect(result).toHaveLength(0);
    });

    it('should group by method', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'post',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const groupKeys: string[] = [];
      context.validateGroupedCommonHttpTransactions(
        statusCode(200),
        method(),
        (key) => {
          groupKeys.push(key);
          return [];
        },
      );

      expect(groupKeys).toContain('get');
      expect(groupKeys).toContain('post');
    });

    it('should filter by role when grouping', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const contextWithRole = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['client'],
      );

      const groupKeys: string[] = [];
      contextWithRole.validateGroupedCommonHttpTransactions(
        statusCode(200),
        method(),
        (key, transactions) => {
          groupKeys.push(key);
          expect(transactions).toHaveLength(1);
          return [];
        },
      );

      expect(groupKeys).toHaveLength(1);
    });
  });

  describe('validateHttpTransactions', () => {
    it('should validate transactions using filter expression', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateHttpTransactions(
        and(method('get'), statusCode(200)),
      );

      expect(result).toHaveLength(1);
    });

    it('should validate with custom validation function', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateHttpTransactions(
        method('get'),
        (req, res, location) => [
          {
            location,
            violation: {
              message: `Request to ${req.path} returned ${res.statusCode}`,
            },
            findings: [],
          },
        ],
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            violation: { message: 'Request to /users returned 200' },
          }),
        ]),
      );
    });

    it('should not return violations when validation returns false', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: { 'x-custom-header': 'value' },
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateHttpTransactions(method('get'), () => []);

      expect(result).toHaveLength(0);
    });

    it('should filter by role in validateHttpTransactions', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {
            role: 'server',
          },
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {
            role: 'proxy',
          },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 150,
          },
          meta: {
            role: 'origin server',
          },
        },
      });

      const format = createThymianFormat();
      const contextWithRole = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
        undefined,
        ['client'],
      );

      const result = contextWithRole.validateHttpTransactions(statusCode(200));

      expect(result).toHaveLength(1);
    });

    it('should resolve transaction edge locations for parameterized paths', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users/not-a-number',
            headers: {
              accept: 'application/json',
            },
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {
              'content-type': 'application/json',
            },
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const [, , transactionId] = format.addHttpTransaction(
        createHttpRequest({
          method: 'GET',
          host: 'api.example.com',
          path: '/users/{id}',
          headers: {
            accept: {
              schema: { type: 'string' },
            },
          },
          mediaType: '',
          pathParameters: {
            id: {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          },
        }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
        }),
        'test-source',
      );

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateHttpTransactions(method('get'));

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: {
              elementType: 'edge',
              elementId: transactionId,
              label: httpTransactionToLabel(
                {
                  method: 'get',
                  origin: 'https://api.example.com',
                  path: '/users/not-a-number',
                  headers: {
                    accept: 'application/json',
                  },
                },
                {
                  statusCode: 200,
                  headers: {
                    'content-type': 'application/json',
                  },
                  trailers: {},
                  duration: 100,
                },
              ),
            },
          }),
        ]),
      );
    });
  });

  describe('request target userinfo preservation', () => {
    // Regression: HAR ingestion used to reduce the request URI to origin+path,
    // stripping userinfo before rules could see it. `target` must survive the
    // DB round-trip so userinfo rules can run on captured traffic.
    const userinfoUrl = 'https://user:pass@api.example.com/users';

    function hasUserinfo(req: {
      target?: string;
      path: string;
      origin: string;
    }): boolean {
      const url = new URL(req.target ?? req.path, req.origin);
      return !!url.username || !!url.password;
    }

    it('exposes captured userinfo via HttpRequest.target', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            target: userinfoUrl,
            headers: {},
          },
          meta: {},
        },
      });

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      const result = context.validateHttpTransactions(
        method('get'),
        (req, _res, location) =>
          hasUserinfo(req) ? [{ location, violation: {}, findings: [] }] : [],
      );

      expect(result).toHaveLength(1);
    });

    it('exposes captured userinfo via CommonHttpRequest.target', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            target: userinfoUrl,
            headers: {},
          },
          meta: {},
        },
      });

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      const result = context.validateCommonHttpTransactions(
        method('get'),
        (req, _res, location) =>
          hasUserinfo(req) ? [{ location, violation: {}, findings: [] }] : [],
      );

      expect(result).toHaveLength(1);
    });

    it('reports no userinfo for a plain target URI', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            target: 'https://api.example.com/users',
            headers: {},
          },
          meta: {},
        },
      });

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      const result = context.validateHttpTransactions(
        method('get'),
        (req, _res, location) =>
          hasUserinfo(req) ? [{ location, violation: {}, findings: [] }] : [],
      );

      expect(result).toHaveLength(0);
    });

    it('exposes captured userinfo through the grouped read path (readRequestById)', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            target: userinfoUrl,
            headers: {},
          },
          meta: {},
        },
      });

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      let sawUserinfo = false;
      context.validateGroupedCommonHttpTransactions(
        method('get'),
        method(),
        (_key, transactions) => {
          sawUserinfo = transactions.some(([req]) => hasUserinfo(req));
          return [];
        },
      );

      expect(sawUserinfo).toBe(true);
    });
  });

  describe('query string preservation across read paths', () => {
    // Regression: the query string is stripped from `path` on insert and
    // persisted separately, then re-appended on read. The flat read path
    // (readTransactionsByHttpFilter) used to skip that re-append, silently
    // dropping query parameters — and with them CommonHttpRequest.queryParameters
    // — for non-grouped validations, while the grouped path (readRequestById)
    // kept them. Both paths must now reconstruct the same query string.
    const pathWithQuery = '/users?role=admin&status=active';

    function insertQueryTransaction(): void {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: pathWithQuery,
            headers: {},
          },
          meta: {},
        },
      });
    }

    it('preserves the query string on HttpRequest.path via the flat read path', () => {
      insertQueryTransaction();

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      const paths: string[] = [];
      context.validateHttpTransactions(method('get'), (req) => {
        paths.push(req.path);
        return [];
      });

      expect(paths).toEqual([pathWithQuery]);
    });

    it('exposes query parameters on CommonHttpRequest via the flat read path', () => {
      insertQueryTransaction();

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      let queryParameters: string[] = [];
      context.validateCommonHttpTransactions(method('get'), (req) => {
        queryParameters = req.queryParameters;
        return [];
      });

      expect(queryParameters).toEqual(['role', 'status']);
    });

    it('reconstructs identical paths on the flat and grouped read paths', () => {
      insertQueryTransaction();

      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        createThymianFormat(),
      );

      let flatPath: string | undefined;
      context.validateHttpTransactions(method('get'), (req) => {
        flatPath = req.path;
        return [];
      });

      let groupedPath: string | undefined;
      context.validateGroupedCommonHttpTransactions(
        method('get'),
        method(),
        (_key, transactions) => {
          groupedPath = transactions[0]?.[0].path;
          return [];
        },
      );

      expect(flatPath).toBe(pathWithQuery);
      expect(flatPath).toBe(groupedPath);
    });
  });

  describe('Complex filter scenarios', () => {
    it('should handle statusCodeRange filter', async () => {
      insertTransaction({
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });
      insertTransaction({
        response: {
          data: {
            statusCode: 404,
            headers: {},
            trailers: {},
            duration: 50,
          },
          meta: {},
        },
      });
      insertTransaction({
        response: {
          data: {
            statusCode: 500,
            headers: {},
            trailers: {},
            duration: 75,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        statusCodeRange(400, 599),
      );

      expect(result).toHaveLength(2);
    });

    it('should handle path filter', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/posts',
            headers: {},
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(path('/users'));

      expect(result).toHaveLength(1);
    });

    it('should handle origin filter', async () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://other.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCommonHttpTransactions(
        origin('https://api.example.com'),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('validateCapturedHttpTraces', () => {
    it('should validate traces with single transaction', () => {
      insertTransaction({
        request: {
          data: {
            method: 'get',
            origin: 'https://api.example.com',
            path: '/users',
            headers: {},
          },
          meta: {},
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: {},
        },
      });

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCapturedHttpTraces((trace, location) => {
        if (trace.length === 1) {
          return [
            {
              location,
              violation: { message: 'Single transaction trace' },
              findings: [],
            },
          ];
        }
        return [];
      });

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            violation: { message: 'Single transaction trace' },
          }),
        ]),
      );
    });

    it('should validate traces with multiple transactions', () => {
      repository.insertHttpTrace([
        {
          request: {
            data: {
              method: 'get',
              origin: 'https://proxy.example.com',
              path: '/users',
              headers: {},
            },
            meta: { role: 'proxy' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'proxy' },
          },
        },
        {
          request: {
            data: {
              method: 'get',
              origin: 'https://api.example.com',
              path: '/users',
              headers: {},
            },
            meta: { role: 'origin server' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'origin server' },
          },
        },
      ]);

      repository.insertHttpTrace([
        {
          request: {
            data: {
              method: 'get',
              origin: 'https://cache.example.com',
              path: '/users',
              headers: {},
            },
            meta: { role: 'cache' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'cache' },
          },
        },
        {
          request: {
            data: {
              method: 'get',
              origin: 'https://cache.example.com',
              path: '/users',
              headers: {},
            },
            meta: { role: 'origin server' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'origin server' },
          },
        },
      ]);

      repository.insertHttpTrace([
        {
          request: {
            data: {
              method: 'get',
              origin: 'https://api.example.com',
              path: '/users',
              headers: {},
            },
            meta: { role: 'origin server' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'origin server' },
          },
        },
      ]);

      const format = createThymianFormat();
      const context = new AnalyticsApiContext(
        repository,
        new NoopLogger(),
        format,
      );

      const result = context.validateCapturedHttpTraces((trace, location) => {
        const [first, last] = trace;

        if (!first || !last) {
          return [];
        }

        if (
          first.request.meta.role === 'proxy' &&
          last.response.meta.role === 'origin server' &&
          first.request.data.method === 'get'
        ) {
          return [{ location, violation: {}, findings: [] }];
        }
        return [];
      });

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: expect.stringContaining('https://proxy.example.com'),
          }),
        ]),
      );
    });
  });
});
