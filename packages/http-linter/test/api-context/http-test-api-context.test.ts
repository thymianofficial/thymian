import type {
  HttpRequest,
  HttpRequestTemplate,
  HttpResponse,
} from '@thymian/core';
import {
  and,
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  method,
  NoopLogger,
  not,
  or,
  port,
  responseHeader,
  responseMediaType,
  statusCode,
  type ThymianFormat,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormat,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import {
  createHttpTestContext,
  type HttpTestContext,
} from '@thymian/http-testing';
import { describe, expect, it, vi } from 'vitest';

import { HttpTestApiContext } from '../../src/api-context/http-test-api-context.js';

function createMockHttpTestContext(
  override: Partial<{
    format: ThymianFormat;
    sampleRequest: HttpTestContext['sampleRequest'];
    runRequest: HttpTestContext['runRequest'];
    runHook: HttpTestContext['runHook'];
  }>,
): HttpTestContext {
  const implementations = {
    sampleRequest: vi
      .fn()
      .mockImplementation(async (transaction): Promise<HttpRequestTemplate> => {
        return {
          method: transaction.thymianReq.method,
          origin: 'https://api.example.com',
          path: transaction.thymianReq.path,
          headers: transaction.thymianReq.headers ?? {},
          pathParameters: {},
          query: {},
          authorize: true,
          cookies: {},
        };
      }),
    runRequest: vi.fn().mockImplementation(async (): Promise<HttpResponse> => {
      return {
        statusCode: 200,
        duration: 0,
        trailers: {},
        headers: { 'content-type': 'application/json' },
      };
    }),
    runHook: vi.fn().mockImplementation(async (hookName, hook) => {
      return {
        result: hook.value,
      };
    }),
    format: createThymianFormat(),
    ...override,
  };

  return createHttpTestContext({
    format: implementations.format,
    logger: new NoopLogger(),
    locals: {},
    sampleRequest: implementations.sampleRequest,
    runRequest: implementations.runRequest,
    runHook: implementations.runHook,
  });
}

describe('HttpTestApiContext', () => {
  describe('validateCommonHttpTransactions', () => {
    it('should validate transactions with filter expression', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({
          statusCode: 200,
          headers: {},
          mediaType: 'text/plain',
        }),
      );

      const mockContext = createMockHttpTestContext({
        format,
      });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        body: '',
        bodyEncoding: '',
        duration: 0,
        trailers: {},
        statusCode: 200,
        headers: {},
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateCommonHttpTransactions(
        statusCode(200),
        not(responseMediaType('application/json')),
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no transactions match', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateCommonHttpTransactions(
        statusCode(404),
      );

      expect(result).toHaveLength(0);
    });

    it('should support custom validation function', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        duration: 0,
        trailers: {},
        statusCode: 200,
        headers: {
          // this should be there
          //'content-type': 'application/json',
        },
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateCommonHttpTransactions(
        statusCode(200),
        (req, res) => {
          return (
            res.statusCode === 200 && !res.headers.includes('content-type')
          );
        },
      );

      expect(result).toHaveLength(1);
    });

    it('should support validation function returning violation object', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        statusCode: 200,
        headers: {},
        duration: 0,
        trailers: {},
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateCommonHttpTransactions(
        statusCode(200),
        () => {
          return { message: 'Custom violation', location: '' };
        },
      );

      expect(result).toHaveLength(1);
      if (Array.isArray(result)) {
        expect(result?.[0]?.message).toBe('Custom violation');
      }
    });

    it('should ignore the skipped origins', async () => {
      const format = createThymianFormat();
      const [, , id] = format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users', host: 'localhost' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({
          method: 'post',
          path: '/users',
          host: 'api.example.com',
        }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-2',
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        statusCode: 200,
        headers: {},
        duration: 0,
        trailers: {},
      });

      const context = new HttpTestApiContext(
        'test-rule',
        mockContext,
        vi.fn(),
        ['*.example.com'],
      );

      const result = await context.validateCommonHttpTransactions(
        statusCode(200),
        () => {
          return { message: 'Custom violation' };
        },
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: { elementType: 'edge', elementId: id, pointer: '' },
          }),
        ]),
      );
    });
  });

  describe('validateGroupedCommonHttpTransactions', () => {
    it('should group and validate transactions', async () => {
      const format = createThymianFormat();
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/posts' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-2',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'post', path: '/users' }),
        createHttpResponse({ statusCode: 201, headers: {} }),
        'test-source-3',
      );

      const mockContext = createMockHttpTestContext({
        format,
        runRequest: async (req: HttpRequest): Promise<HttpResponse> => {
          if (req.method === 'get') {
            return {
              duration: 0,
              trailers: {},
              statusCode: 200,
              headers: {},
            };
          }
          return {
            duration: 0,
            trailers: {},
            statusCode: 201,
            headers: {},
          };
        },
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const groupKeys: string[] = [];
      const result = await context.validateGroupedCommonHttpTransactions(
        or(statusCode(200), statusCode(201)),
        method(),
        (key) => {
          groupKeys.push(key);
          return undefined;
        },
      );

      expect(groupKeys).toEqual(expect.arrayContaining(['GET', 'POST']));
      expect(result).toHaveLength(0);
    });

    it('should return violations from validation function', async () => {
      const format = createThymianFormat();
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users', port: 3000 }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/posts', port: 8080 }),
        createHttpResponse({
          statusCode: 200,
          headers: {
            etag: {
              required: true,
              style: DEFAULT_HEADER_SERIALIZATION_STYLE,
              schema: {
                type: 'string',
              },
            },
          },
        }),
        'test-source-2',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/posts', port: 3000 }),
        createHttpResponse({
          statusCode: 200,
          headers: {
            etag: {
              required: true,
              style: DEFAULT_HEADER_SERIALIZATION_STYLE,
              schema: {
                type: 'string',
              },
            },
          },
        }),
        'test-source-2',
      );

      const mockContext = createMockHttpTestContext({
        format,

        runRequest: async (req: HttpRequest): Promise<HttpResponse> => {
          if (req.path === '/users') {
            return {
              duration: 0,
              trailers: {},
              statusCode: 200,
              headers: {},
            };
          }
          return {
            duration: 0,
            trailers: {},
            statusCode: 200,
            headers: {
              etag: '"12345"',
            },
          };
        },
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateGroupedCommonHttpTransactions(
        method('get'),
        port(),
        (key, transactions) => {
          if (!transactions.every(([, res]) => res.headers.includes('etag'))) {
            return {
              location: {
                elementType: 'node',
                elementId: 'test-violation',
              },
              message: `no etag`,
            };
          }
          return undefined;
        },
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `no etag`,
          }),
        ]),
      );
    });
  });

  describe('validateHttpTransactions', () => {
    it('should validate with filter expression', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        duration: 0,
        trailers: {},
        statusCode: 200,
        headers: {},
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateHttpTransactions(
        and(method('get'), statusCode(200)),
        not(responseHeader('x-custom-header')),
      );

      expect(result).toHaveLength(1);
    });

    it('should validate with custom function', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        duration: 0,
        trailers: {},
        statusCode: 200,
        headers: {},
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateHttpTransactions(
        method('get'),
        (req, res) => ({
          message: `Request to ${req.path} returned ${res.statusCode}`,
        }),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `Request to /users returned 200`,
          }),
        ]),
      );
    });

    it('should not return violations when validation returns false', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({ format });
      vi.mocked(mockContext.runRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'x-custom-header': 'value' },
        duration: 0,
        trailers: {},
      });

      const context = new HttpTestApiContext('test-rule', mockContext, vi.fn());

      const result = await context.validateHttpTransactions(
        method('get'),
        () => false,
      );

      expect(result).toHaveLength(0);
    });
  });
});
