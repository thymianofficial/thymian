import {
  hasResponseBody,
  type HttpRequest,
  type HttpRequestTemplate,
  type HttpResponse,
  statusCodeRange,
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
  singleTestCase,
  statusCode,
  type ThymianFormat,
} from '@thymian/core';
import { createHttpTestContext, type HttpTestContext } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormat,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { describe, expect, it, vi } from 'vitest';

import { HttpTestApiContext } from '../src/http-test-api-context.js';

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

      const context = new HttpTestApiContext('test-rule', mockContext);

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

      const context = new HttpTestApiContext('test-rule', mockContext);

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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const result = await context.validateCommonHttpTransactions(
        statusCode(200),
        (req, res, location) => {
          if (res.statusCode === 200 && !res.headers.includes('content-type')) {
            return [{ location, violation: {}, findings: [] }];
          }
          return [];
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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const result = await context.validateCommonHttpTransactions(
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
      expect(result?.[0]?.violation?.message).toBe('Custom violation');
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

      const context = new HttpTestApiContext('test-rule', mockContext, [
        '*.example.com',
      ]);

      const result = await context.validateCommonHttpTransactions(
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
            location: { elementType: 'edge', elementId: id },
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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const groupKeys: string[] = [];
      const result = await context.validateGroupedCommonHttpTransactions(
        or(statusCode(200), statusCode(201)),
        method(),
        (key) => {
          groupKeys.push(key);
          return [];
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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const result = await context.validateGroupedCommonHttpTransactions(
        method('get'),
        port(),
        (key, transactions) => {
          if (!transactions.every(([, res]) => res.headers.includes('etag'))) {
            return [
              {
                location: {
                  elementType: 'node' as const,
                  elementId: 'test-violation',
                },
                violation: { message: `no etag` },
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
            violation: { message: `no etag` },
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

      const context = new HttpTestApiContext('test-rule', mockContext);

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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const result = await context.validateHttpTransactions(
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
            violation: { message: `Request to /users returned 200` },
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

      const context = new HttpTestApiContext('test-rule', mockContext);

      const result = await context.validateHttpTransactions(
        method('get'),
        () => [],
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('getRuleExecutionDiagnostics', () => {
    it('should return undefined when no tests have been run', () => {
      const format = createThymianFormat();
      const mockContext = createMockHttpTestContext({ format });
      const context = new HttpTestApiContext('test', mockContext);

      expect(context.getRuleExecutionDiagnostics()).toBeUndefined();
    });

    it('should expose skipped test cases as rule diagnostics', async () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const mockContext = createMockHttpTestContext({
        format,
        runRequest: async (req: HttpRequest): Promise<HttpResponse> => ({
          duration: 0,
          trailers: {},
          statusCode: req.method === 'post' ? 201 : 200,
          headers: {},
        }),
      });
      const context = new HttpTestApiContext('diagnostic-test', mockContext);

      await context.httpTest(
        singleTestCase()
          .forTransactionsWith(method('get'))
          .run()
          .skipIf(statusCode(200), 'Skip because status is 200')
          .done(),
      );

      const diagnostics = context.getRuleExecutionDiagnostics();
      expect(diagnostics).toHaveLength(1);
      const skippedCase = diagnostics?.[0]?.testResult.cases.find(
        (c) => c.status === 'skipped',
      );
      expect(skippedCase).toMatchObject({
        name: expect.any(String),
        reason: 'Skip because status is 200',
      });
    });

    it('should accumulate diagnostics across multiple httpTest calls', async () => {
      const format = createThymianFormat();
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'post', path: '/users' }),
        createHttpResponse({ statusCode: 201, headers: {} }),
        'test-source-2',
      );

      const mockContext = createMockHttpTestContext({ format });
      const context = new HttpTestApiContext('diagnostic-test', mockContext);

      await context.httpTest(
        singleTestCase()
          .forTransactionsWith(method('get'))
          .run()
          .skipIf(statusCode(200), 'Skip because status is 200')
          .done(),
      );

      const diagnosticsAfterFirst = context.getRuleExecutionDiagnostics();
      expect(diagnosticsAfterFirst).toHaveLength(1);
      const casesAfterFirst =
        diagnosticsAfterFirst?.[0]?.testResult.cases ?? [];
      expect(
        casesAfterFirst.filter((c) => c.status === 'skipped'),
      ).toHaveLength(1);
      expect(casesAfterFirst.filter((c) => c.status === 'failed')).toHaveLength(
        0,
      );
      expect(casesAfterFirst.filter((c) => c.status === 'passed')).toHaveLength(
        0,
      );

      await context.httpTest(
        singleTestCase()
          .forTransactionsWith(method('get'))
          .run()
          .skipIf(statusCode(200), 'Skip GET second time')
          .done(),
      );

      const diagnosticsAfterSecond = context.getRuleExecutionDiagnostics();
      expect(diagnosticsAfterSecond).toHaveLength(2);
      const allCases =
        diagnosticsAfterSecond?.flatMap((r) => r.testResult.cases) ?? [];
      const skippedCases = allCases.filter((c) => c.status === 'skipped');
      expect(skippedCases).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({ reason: 'Skip because status is 200' }),
          expect.objectContaining({ reason: 'Skip GET second time' }),
        ]),
      );
    });

    it('should record passed test cases', async () => {
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

      const context = new HttpTestApiContext('pass-test', mockContext);

      await context.httpTest(
        singleTestCase().forTransactionsWith(method('get')).run().done(),
      );

      const diagnostics = context.getRuleExecutionDiagnostics();
      expect(diagnostics).toHaveLength(1);
      const passedCases =
        diagnostics?.[0]?.testResult.cases.filter(
          (c) => c.status === 'passed',
        ) ?? [];
      expect(passedCases).toHaveLength(1);
      expect(passedCases[0]?.name).toEqual(expect.any(String));
      expect(
        diagnostics?.[0]?.testResult.cases.filter(
          (c) => c.status === 'skipped',
        ),
      ).toHaveLength(0);
      expect(
        diagnostics?.[0]?.testResult.cases.filter((c) => c.status === 'failed'),
      ).toHaveLength(0);
    });

    it('should capture dispatched http transactions in step data', async () => {
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

      const context = new HttpTestApiContext('transaction-test', mockContext);

      await context.httpTest(
        singleTestCase()
          .forTransactionsWith(method('get'))
          .run()
          .skipIf(statusCode(200), 'Skip because status is 200')
          .done(),
      );

      await context.httpTest(
        singleTestCase().forTransactionsWith(method('get')).run().done(),
      );

      const diagnostics = context.getRuleExecutionDiagnostics();
      const allCases = diagnostics?.flatMap((r) => r.testResult.cases) ?? [];
      const skippedCase = allCases.find((c) => c.status === 'skipped');
      const passedCase = allCases.find((c) => c.status === 'passed');

      const getStepTransactions = (
        testCase: (typeof allCases)[number] | undefined,
      ) =>
        testCase?.steps.flatMap((s) =>
          s.transactions
            .filter((t) => t.request && t.response)
            .map((t) => ({ request: t.request!, response: t.response! })),
        ) ?? [];

      expect(getStepTransactions(skippedCase)).toMatchObject([
        {
          request: expect.objectContaining({ method: 'get' }),
          response: expect.objectContaining({ statusCode: 200 }),
        },
      ]);
      expect(getStepTransactions(passedCase)).toMatchObject([
        {
          request: expect.objectContaining({ method: 'get' }),
          response: expect.objectContaining({ statusCode: 200 }),
        },
      ]);
    });
  });
});
