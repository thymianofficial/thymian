import {
  and,
  constant,
  hasRequestBody,
  hasResponseBody,
  matchesOrigin,
  method,
  NoopLogger,
  not,
  or,
  origin,
  path,
  requestMediaType,
  responseMediaType,
  statusCode,
  statusCodeRange,
} from '@thymian/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SqliteHttpTransactionRepository } from '../../src/db/sqlite/sqlite-http-transaction-repository.js';
import type { CapturedTrace, CapturedTransaction } from '../../src/types.js';

describe('HttpTransactionRepository', () => {
  let repo: SqliteHttpTransactionRepository;
  const logger = new NoopLogger();

  beforeEach(async () => {
    repo = new SqliteHttpTransactionRepository(':memory:', logger);
    await repo.init();
  });

  afterEach(async () => {
    await repo.close();
  });

  describe('Initialization & Cleanup', () => {
    it('should initialize without error', async () => {
      const newRepo = new SqliteHttpTransactionRepository(':memory:', logger);
      await expect(newRepo.init()).resolves.toBeUndefined();
      await newRepo.close();
    });

    it('should close without error', () => {
      expect(() => repo.close()).not.toThrow();
    });

    it('should handle multiple init calls', async () => {
      await repo.init();
      await expect(repo.init()).resolves.toBeUndefined();
    });
  });

  describe('insertHttpTransaction', () => {
    it('should insert and read back a minimal transaction', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/users',
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
      };

      const id = await repo.insertHttpTransaction(transaction);
      expect(typeof id).toBe('number');

      const retrieved = await repo.readTransactionById(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.request.data.method).toBe('GET');
      expect(retrieved?.request.data.origin).toBe('https://api.example.com');
      expect(retrieved?.request.data.path).toBe('/users');
      expect(retrieved?.response.data.statusCode).toBe(200);
      expect(retrieved?.response.data.duration).toBe(100);
    });

    it('should insert transaction with complete data', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'POST',
            origin: 'https://api.example.com',
            path: '/users/123',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: '{"name":"John"}',
            bodyEncoding: 'utf-8',
          },
          meta: {
            role: 'client',
          },
        },
        response: {
          data: {
            statusCode: 201,
            headers: {
              'content-type': 'application/json',
              location: '/users/123',
            },
            trailers: {},
            body: '{"id":123,"name":"John"}',
            bodyEncoding: 'utf-8',
            duration: 150.5,
          },
          meta: {
            role: 'server',
          },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      expect(id).toBeTruthy();

      const retrieved = await repo.readTransactionById(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.request.data.body).toBe('{"name":"John"}');
      expect(retrieved?.request.data.bodyEncoding).toBe('utf-8');
      expect(retrieved?.request.data.headers).toMatchObject({
        'content-type': 'application/json',
        accept: 'application/json',
      });
      expect(retrieved?.response.data.body).toBe('{"id":123,"name":"John"}');
      expect(retrieved?.response.data.bodyEncoding).toBe('utf-8');
      expect(retrieved?.response.data.headers).toMatchObject({
        'content-type': 'application/json',
        location: '/users/123',
      });
    });

    it('should return undefined for non-existent transaction ID', async () => {
      const retrieved = await repo.readTransactionById(99999);
      expect(retrieved).toBeUndefined();
    });

    it('should handle different participant roles', async () => {
      const roles = [
        ['client', 'server'],
        ['proxy', 'origin server'],
        ['gateway', 'server'],
        ['cache', 'client'],
      ] as const;

      const ids: number[] = [];

      for (const [requestRole, responseRole] of roles) {
        const transaction: CapturedTransaction = {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/test',
            },
            meta: { role: requestRole },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: responseRole },
          },
        };

        ids.push(await repo.insertHttpTransaction(transaction));
      }

      for (const [idx, id] of ids.entries()) {
        const retrieved = await repo.readTransactionById(id);
        expect(retrieved?.request.meta.role).toBe(roles[idx]?.[0]);
        expect(retrieved?.response.meta.role).toBe(roles[idx]?.[1]);
      }
    });

    it('should handle array header values', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/items',
            headers: {
              'x-custom': ['value1', 'value2', 'value3'],
              accept: 'application/json',
            },
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {
              vary: ['accept-encoding', 'accept-language'],
              'set-cookie': ['session=abc', 'token=xyz'],
            },
            trailers: {},
            duration: 100,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.request.data.headers?.['x-custom']).toEqual(
        expect.arrayContaining(['value1', 'value2', 'value3']),
      );
      expect(retrieved?.response.data.headers?.['vary']).toEqual(
        expect.arrayContaining(['accept-encoding', 'accept-language']),
      );
    });

    it('should handle headers with special characters', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/test',
            headers: {
              'x-special': 'value with spaces and @#$%',
              'user-agent': 'Mozilla/5.0 (compatible)',
            },
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
            trailers: {},
            duration: 50,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved?.request.data.headers?.['x-special']).toBe(
        'value with spaces and @#$%',
      );
      expect(retrieved?.response.data.headers?.['content-type']).toBe(
        'text/html; charset=utf-8',
      );
    });

    it('should store response trailers', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/stream',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {
              checksum: 'abc123',
              'content-md5': 'xyz789',
            },
            duration: 200,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
      // Note: Based on implementation, trailers may return empty
      expect(retrieved?.response.data.trailers).toMatchObject({
        checksum: 'abc123',
        'content-md5': 'xyz789',
      });
    });

    it('should handle path with query parameters', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/search?q=test&page=1&limit=10',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 100,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
      // Path should be normalized (query params removed)
      expect(retrieved?.request.data.path).toBe(
        '/search?q=test&page=1&limit=10',
      );
    });

    it('should handle duplicate query parameter names', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/items?tag=red&tag=blue&tag=green',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 80,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.request.data.path).toBe(
        '/items?tag=red&tag=blue&tag=green',
      );
    });

    it('should handle path without query parameters', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'POST',
            origin: 'https://api.example.com',
            path: '/users/123/profile',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            duration: 90,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved?.request.data.path).toBe('/users/123/profile');
    });

    it('should handle undefined body', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'GET',
            origin: 'https://api.example.com',
            path: '/test',
            body: undefined,
            bodyEncoding: undefined,
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 204,
            headers: {},
            trailers: {},
            body: undefined,
            bodyEncoding: undefined,
            duration: 50,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
    });

    it('should handle empty string body', async () => {
      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'POST',
            origin: 'https://api.example.com',
            path: '/test',
            body: '',
            bodyEncoding: 'utf-8',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 200,
            headers: {},
            trailers: {},
            body: '',
            bodyEncoding: 'utf-8',
            duration: 60,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved).toBeDefined();
    });

    it('should handle large body content', async () => {
      const largeBody = 'x'.repeat(10000);

      const transaction: CapturedTransaction = {
        request: {
          data: {
            method: 'POST',
            origin: 'https://api.example.com',
            path: '/upload',
            body: largeBody,
            bodyEncoding: 'utf-8',
          },
          meta: { role: 'client' },
        },
        response: {
          data: {
            statusCode: 201,
            headers: {},
            trailers: {},
            body: largeBody,
            bodyEncoding: 'utf-8',
            duration: 500,
          },
          meta: { role: 'server' },
        },
      };

      const id = await repo.insertHttpTransaction(transaction);
      const retrieved = await repo.readTransactionById(id);

      expect(retrieved?.request.data.body?.length).toBe(10000);
      expect(retrieved?.response.data.body?.length).toBe(10000);
    });
  });

  describe('readTransactionsByHttpFilter', () => {
    beforeEach(async () => {
      // Insert test data
      const transactions: CapturedTransaction[] = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'POST',
              origin: 'https://api.example.com:8080',
              path: '/users',
              headers: {
                'content-type': 'application/json',
              },
              body: '{"name":"Alice"}',
              bodyEncoding: 'utf-8',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 201,
              headers: {
                'content-type': 'application/json',
              },
              trailers: {},
              body: '{"id":1,"name":"Alice"}',
              bodyEncoding: 'utf-8',
              duration: 150,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/products',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 404,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'PUT',
              origin: 'https://api.example.com',
              path: '/users/1',
              headers: {
                'content-type': 'application/json',
              },
              body: '{"name":"Bob"}',
              bodyEncoding: 'utf-8',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {
                'content-type': 'application/json',
              },
              trailers: {},
              body: '{"id":1,"name":"Bob"}',
              bodyEncoding: 'utf-8',
              duration: 120,
            },
            meta: { role: 'proxy' },
          },
        },
        {
          request: {
            data: {
              method: 'DELETE',
              origin: 'https://api.example.com',
              path: '/users/1',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 204,
              headers: {},
              trailers: {},
              duration: 80,
            },
            meta: { role: 'proxy' },
          },
        },
      ];

      for (const tx of transactions) {
        await repo.insertHttpTransaction(tx);
      }
    });

    it('should filter by method', async () => {
      const filter = method('GET');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(results.every((tx) => tx.request.data.method === 'GET')).toBe(
        true,
      );
    });

    it('should filter by path', async () => {
      const filter = path('/users');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(results.every((tx) => tx.request.data.path === '/users')).toBe(
        true,
      );
    });

    it('should filter by status code', async () => {
      const filter = statusCode(200);

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(results.every((tx) => tx.response.data.statusCode === 200)).toBe(
        true,
      );
    });

    it('should filter by status code range', async () => {
      const filter = statusCodeRange(200, 299);

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(4);
      expect(
        results.every(
          (tx) =>
            tx.response.data.statusCode >= 200 &&
            tx.response.data.statusCode <= 299,
        ),
      ).toBe(true);
    });

    it('should filter by request header', async () => {
      const filter = requestMediaType('application/json');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(
        results.every(
          (tx) =>
            tx.request.data.headers?.['content-type'] === 'application/json',
        ),
      ).toBe(true);
    });

    it('should filter by response header', async () => {
      const filter = responseMediaType('application/json');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(
        results.every(
          (tx) =>
            tx.response.data.headers?.['content-type'] === 'application/json',
        ),
      ).toBe(true);
    });

    it('should filter by origin', async () => {
      const filter = origin('https://api.example.com');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(4);
      expect(
        results.every(
          (tx) => tx.request.data.origin === 'https://api.example.com',
        ),
      ).toBe(true);
    });

    it('should filter by hasBody (request)', async () => {
      const filter = hasRequestBody(true);

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(results.every((tx) => tx.request.data.body !== undefined)).toBe(
        true,
      );
    });

    it('should filter by hasResponseBody', async () => {
      const filter = hasResponseBody(true);

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(results.every((tx) => tx.response.data.body !== undefined)).toBe(
        true,
      );
    });

    it('should support AND logic filter', async () => {
      const filter = and(method('GET'), path('/users'));

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(1);
      expect(results[0]?.request.data.method).toBe('GET');
      expect(results[0]?.request.data.path).toBe('/users');
    });

    it('should support OR logic filter', async () => {
      const filter = or(method('POST'), method('PUT'));

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(
        results.every(
          (tx) =>
            tx.request.data.method === 'POST' ||
            tx.request.data.method === 'PUT',
        ),
      ).toBe(true);
    });

    it('should support NOT logic filter', async () => {
      const filter = not(method('GET'));

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(3);
      expect(results.every((tx) => tx.request.data.method !== 'GET')).toBe(
        true,
      );
    });

    it('should support complex nested filters', async () => {
      const filter = and(
        or(method('POST'), method('PUT')),
        statusCodeRange(200, 299),
      );

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(2);
      expect(
        results.every(
          (tx) =>
            (tx.request.data.method === 'POST' ||
              tx.request.data.method === 'PUT') &&
            tx.response.data.statusCode >= 200 &&
            tx.response.data.statusCode <= 299,
        ),
      ).toBe(true);
    });

    it('should return empty iterator for no matches', async () => {
      const filter = method('PATCH');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(0);
    });

    it('should handle constant filter (true)', async () => {
      const filter = constant(true);

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(5);
    });

    it('should handle constant filter (falsy)', async () => {
      const filter = constant('');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results.length).toBe(0);
    });

    it('should handle roles', async () => {
      const filter = method('DELETE');

      const results = Array.from(
        repo.readTransactionsByHttpFilter(filter, ['proxy']),
      );

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        request: {
          data: {
            method: 'DELETE',
          },
        },
        response: {
          meta: { role: 'proxy' },
        },
      });
    });

    it('should handle origin wildcard', async () => {
      const filter = matchesOrigin('https://api.*.com:8080');

      const results = Array.from(repo.readTransactionsByHttpFilter(filter));

      expect(results).toHaveLength(1);
      expect(results[0]?.request.data).toEqual(
        expect.objectContaining({
          origin: 'https://api.example.com:8080',
        }),
      );
    });
  });

  describe('readAndGroupTransactionsByHttpFilter', () => {
    beforeEach(async () => {
      const transactions: CapturedTransaction[] = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'POST',
              origin: 'https://api.example.com',
              path: '/users',
              headers: {
                'content-type': 'application/json',
              },
              body: '{"name":"Alice"}',
              bodyEncoding: 'utf-8',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 201,
              headers: {
                'content-type': 'application/json',
              },
              trailers: {},
              body: '{"id":1,"name":"Alice"}',
              bodyEncoding: 'utf-8',
              duration: 150,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/products',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 404,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 120,
            },
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'DELETE',
              origin: 'https://api.example.com',
              path: '/users/1',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 204,
              headers: {},
              trailers: {},
              duration: 80,
            },
            meta: { role: 'server' },
          },
        },
      ];

      for (const tx of transactions) {
        await repo.insertHttpTransaction(tx);
      }
    });

    it('should group transactions by method', async () => {
      const filter = statusCodeRange(200, 299);
      const groupBy = method();

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      expect(results).toHaveLength(3);

      // Find GET group
      const getGroup = results.find(([key]) => key === 'GET');
      expect(getGroup).toBeDefined();
      expect(getGroup?.[0]).toBe('GET');
      expect(getGroup?.[1]).toHaveLength(2);
      expect(
        getGroup?.[1].every((tx) => tx.request.data.method === 'GET'),
      ).toBe(true);

      // Find POST group
      const postGroup = results.find(([key]) => key === 'POST');
      expect(postGroup).toBeDefined();
      expect(postGroup?.[0]).toBe('POST');
      expect(postGroup?.[1]).toHaveLength(1);

      // Find DELETE group
      const deleteGroup = results.find(([key]) => key === 'DELETE');
      expect(deleteGroup).toBeDefined();
      expect(deleteGroup?.[0]).toBe('DELETE');
      expect(deleteGroup?.[1]).toHaveLength(1);
    });

    it('should handle complex filter with grouping', async () => {
      const filter = and(statusCodeRange(200, 499), not(statusCode(204)));
      const groupBy = and(origin(), path());

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      expect(results).toHaveLength(2);

      const productsGroup = results.find(
        (g) => g[0] === 'https://api.example.com/products',
      );
      expect(productsGroup).toBeDefined();
      expect(productsGroup?.[1]).toHaveLength(1);
      expect(
        productsGroup?.[1].every(
          (x) =>
            x.request.data.path === '/products' &&
            x.request.data.origin === 'https://api.example.com',
        ),
      ).toBe(true);

      const usersGroup = results.find(
        (g) => g[0] === 'https://api.example.com/users',
      );
      expect(usersGroup).toBeDefined();
      expect(usersGroup?.[1]).toHaveLength(3);
      expect(
        usersGroup?.[1].every(
          (x) =>
            x.request.data.path === '/users' &&
            x.request.data.origin === 'https://api.example.com',
        ),
      ).toBe(true);
    });

    it('should return empty iterator when filter matches nothing', async () => {
      const filter = method('PATCH');
      const groupBy = method();

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      expect(results.length).toBe(0);
    });

    it('should throw error for unsupported group by filter', async () => {
      const filter = constant(true);
      const groupBy = constant('unsupported');

      expect(() =>
        Array.from(repo.readAndGroupTransactionsByHttpFilter(filter, groupBy)),
      ).toThrowError();
    });

    it('should handle empty database', async () => {
      const newRepo = new SqliteHttpTransactionRepository(':memory:', logger);
      await newRepo.init();

      const filter = constant(true);
      const groupBy = method();

      const results = Array.from(
        newRepo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      expect(results.length).toBe(0);
      await newRepo.close();
    });

    it('should preserve transaction details in grouped results', async () => {
      const filter = constant(true);
      const groupBy = method();

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      const postGroup = results.find(([key]) => key === 'POST');
      expect(postGroup).toBeDefined();

      const postTransaction = postGroup?.[1][0];
      expect(postTransaction?.request.data.method).toBe('POST');
      expect(postTransaction?.request.data.path).toBe('/users');
      expect(postTransaction?.request.data.body).toBe('{"name":"Alice"}');
      expect(postTransaction?.response.data.statusCode).toBe(201);
      expect(postTransaction?.response.data.body).toBe(
        '{"id":1,"name":"Alice"}',
      );
    });

    it('should work as iterator without consuming all at once', async () => {
      const filter = constant(true);
      const groupBy = method();

      const iterator = repo.readAndGroupTransactionsByHttpFilter(
        filter,
        groupBy,
      );

      const first = iterator.next();
      expect(first.done).toBe(false);
      expect(first.value).toBeDefined();

      const remaining = Array.from(iterator);
      expect(remaining.length).toBeGreaterThan(0);
    });

    it('should filter by multiple methods and group by status code', async () => {
      const filter = or(method('GET'), method('POST'));
      const groupBy = statusCode();

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      const allTransactions = results.flatMap(([, txs]) => txs);
      expect(allTransactions.length).toBe(4);
      expect(
        allTransactions.every(
          (tx) =>
            tx.request.data.method === 'GET' ||
            tx.request.data.method === 'POST',
        ),
      ).toBe(true);
    });

    it('should group by path and filter by status code range', async () => {
      const filter = statusCodeRange(200, 299);
      const groupBy = path('*');

      const results = Array.from(
        repo.readAndGroupTransactionsByHttpFilter(filter, groupBy),
      );

      const allTransactions = results.flatMap(([, txs]) => txs);
      expect(
        allTransactions.every(
          (tx) =>
            tx.response.data.statusCode >= 200 &&
            tx.response.data.statusCode <= 299,
        ),
      ).toBe(true);

      // Check that /users group exists and has multiple transactions
      const usersGroup = results.find(([key]) => key === '/users');
      expect(usersGroup).toBeDefined();
      expect(usersGroup?.[1].length).toBeGreaterThan(0);
    });
  });

  describe('insertHttpTrace', () => {
    it('should insert and read back a single-transaction trace', async () => {
      const trace: CapturedTrace = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'server' },
          },
        },
      ];

      const id = await repo.insertHttpTrace(trace);
      const retrieved = await repo.readTraceById(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.length).toBe(1);
      expect(retrieved?.[0]?.request.data.method).toBe('GET');
      expect(retrieved?.[0]?.request.data.path).toBe('/users');
    });

    it('should insert and read back a multi-transaction trace', async () => {
      const trace: CapturedTrace = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/auth',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'proxy' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://backend.example.com',
              path: '/verify',
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
            meta: { role: 'server' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://cache.example.com',
              path: '/data',
            },
            meta: { role: 'server' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 30,
            },
            meta: { role: 'cache' },
          },
        },
      ];

      const id = await repo.insertHttpTrace(trace);
      const retrieved = await repo.readTraceById(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.length).toBe(3);
      expect(retrieved?.[0]?.request.data.path).toBe('/auth');
      expect(retrieved?.[1]?.request.data.path).toBe('/verify');
      expect(retrieved?.[2]?.request.data.path).toBe('/data');
    });

    it('should return undefined for non-existent trace ID', async () => {
      const retrieved = await repo.readTraceById(99999);
      expect(retrieved).toBeUndefined();
    });

    it('should handle multiple traces independently', async () => {
      const trace1: CapturedTrace = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api1.example.com',
              path: '/endpoint1',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'server' },
          },
        },
      ];

      const trace2: CapturedTrace = [
        {
          request: {
            data: {
              method: 'POST',
              origin: 'https://api2.example.com',
              path: '/endpoint2',
            },
            meta: { role: 'client' },
          },
          response: {
            data: {
              statusCode: 201,
              headers: {},
              trailers: {},
              duration: 150,
            },
            meta: { role: 'server' },
          },
        },
      ];

      const id1 = await repo.insertHttpTrace(trace1);
      const id2 = await repo.insertHttpTrace(trace2);

      const retrieved1 = await repo.readTraceById(id1);
      const retrieved2 = await repo.readTraceById(id2);

      expect(retrieved1).toHaveLength(1);
      expect(retrieved2).toHaveLength(1);
    });
  });

  describe('readAllHttpTraces', () => {
    it('should return empty iterator when no traces exist', () => {
      const traces = Array.from(repo.readAllHttpTraces());
      expect(traces).toHaveLength(0);
    });

    it('should return all traces from the database', async () => {
      const trace1: CapturedTrace = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'user-agent' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 100,
            },
            meta: { role: 'origin server' },
          },
        },
      ];

      const trace2: CapturedTrace = [
        {
          request: {
            data: {
              method: 'POST',
              origin: 'https://api.example.com',
              path: '/users',
            },
            meta: { role: 'user-agent' },
          },
          response: {
            data: {
              statusCode: 201,
              headers: {},
              trailers: {},
              duration: 150,
            },
            meta: { role: 'origin server' },
          },
        },
      ];

      const trace3: CapturedTrace = [
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://proxy.example.com',
              path: '/api',
            },
            meta: { role: 'proxy' },
          },
          response: {
            data: {
              statusCode: 200,
              headers: {},
              trailers: {},
              duration: 50,
            },
            meta: { role: 'proxy' },
          },
        },
        {
          request: {
            data: {
              method: 'GET',
              origin: 'https://api.example.com',
              path: '/api',
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
      ];

      await repo.insertHttpTrace(trace1);
      await repo.insertHttpTrace(trace2);
      await repo.insertHttpTrace(trace3);

      const allTraces = Array.from(repo.readAllHttpTraces());

      expect(allTraces).toHaveLength(3);
      expect(allTraces[0]).toHaveLength(1);
      expect(allTraces[1]).toHaveLength(1);
      expect(allTraces[2]).toHaveLength(2);
    });

    it('should correctly iterate through traces with iterator protocol', async () => {
      const trace: CapturedTrace = [
        {
          request: {
            data: {
              method: 'DELETE',
              origin: 'https://api.example.com',
              path: '/users/123',
            },
            meta: { role: 'user-agent' },
          },
          response: {
            data: {
              statusCode: 204,
              headers: {},
              trailers: {},
              duration: 75,
            },
            meta: { role: 'origin server' },
          },
        },
      ];

      await repo.insertHttpTrace(trace);

      const iterator = repo.readAllHttpTraces();
      const firstTrace = iterator.next();

      expect(firstTrace.done).toBe(false);
      expect(firstTrace.value).toHaveLength(1);

      const secondTrace = iterator.next();
      expect(secondTrace.done).toBe(true);
    });
  });
});
