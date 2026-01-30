import {
  and,
  method,
  NoopLogger,
  not,
  origin,
  path,
  responseHeader,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { createThymianFormat } from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsApiContext } from '../../src/api-context/analytics-api-context.js';
import { SqliteHttpTransactionRepository } from '../../src/db/sqlite/sqlite-http-transaction-repository.js';
import type { CapturedTransaction } from '../../src/types.js';

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
        (req, res) => {
          return res.statusCode === 200;
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
        () => ({ message: 'Custom violation' }),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Custom violation' }),
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
          return undefined;
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
          return undefined;
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
          return undefined;
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
        (req, res) => ({
          message: `Request to ${req.path} returned ${res.statusCode}`,
        }),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Request to /users returned 200',
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

      const result = context.validateHttpTransactions(
        method('get'),
        () => false,
      );

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
});
