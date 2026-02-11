import {
  and,
  method,
  not,
  path,
  responseMediaType,
  statusCode,
} from '@thymian/core';
import { NoopLogger } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormat,
  createThymianFormatWithTransaction,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import { StaticApiContext } from '../../src/api-context/static-api-context.js';

describe('StaticApiContext', () => {
  describe('validateCommonHttpTransactions', () => {
    it('should return violations when filter expression matches', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );
      const edgeId = format.getHttpTransactions()[0]?.[2];

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        not(method('post')),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: { elementType: 'edge', elementId: edgeId, pointer: '' },
          }),
        ]),
      );
    });

    it('should return empty array when no transactions match filter', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(statusCode(404));

      expect(result).toHaveLength(0);
    });

    it('should support validation function returning boolean', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        () => true,
      );

      expect(result).toHaveLength(1);
    });

    it('should support validation function returning violation object', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        () => ({ message: 'Custom violation message' }),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Custom violation message',
          }),
        ]),
      );
    });

    it('should not return violations when validation function returns false', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        () => false,
      );

      expect(result).toHaveLength(0);
    });

    it('should handle multiple transactions', () => {
      const format = createThymianFormat();
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({
          statusCode: 200,
          headers: {},
          mediaType: 'text/plain',
        }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/posts' }),
        createHttpResponse({
          statusCode: 200,
          headers: {},
          mediaType: 'text/plain',
        }),
        'test-source-2',
      );
      const [, , id] = format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/comments' }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/json',
        }),
        'test-source-3',
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        statusCode(200),
        responseMediaType('application/json'),
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

    it('should combine filter and validation expressions with and', () => {
      const format = createThymianFormat();
      const [, , id] = format.addHttpTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
        'test-source-1',
      );
      format.addHttpTransaction(
        createHttpRequest({ method: 'post', path: '/users' }),
        createHttpResponse({ statusCode: 201, headers: {} }),
        'test-source-2',
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateCommonHttpTransactions(
        and(method('get'), statusCode(200)),
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: {
              elementType: 'edge',
              elementId: id,
              pointer: '',
            },
          }),
        ]),
      );
    });

    it('should ignore skipped origins', () => {
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
        createHttpResponse({ statusCode: 201, headers: {} }),
        'test-source-2',
      );

      const context = new StaticApiContext(
        format,
        new NoopLogger(),
        () => undefined,
        ['*.example.com'],
      );

      const result = context.validateCommonHttpTransactions(path('/users'));

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: {
              elementType: 'edge',
              elementId: id,
              pointer: '',
            },
          }),
        ]),
      );
    });
  });

  describe('validateGroupedCommonHttpTransactions', () => {
    it('should group transactions by status code and validate', () => {
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
        createHttpRequest({ method: 'get', path: '/error' }),
        createHttpResponse({ statusCode: 404, headers: {} }),
        'test-source-3',
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateGroupedCommonHttpTransactions(
        method('get'),
        statusCode(),
        (key, transactions) => {
          if (key === '200' && transactions.length !== 3) {
            return {
              location: {
                elementType: 'node' as const,
                elementId: 'group-violation',
              },
              message: `Expected 3 transactions with status 200, got ${transactions.length}`,
            };
          }
        },
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: { elementType: 'node', elementId: 'group-violation' },
            message: 'Expected 3 transactions with status 200, got 2',
          }),
        ]),
      );
    });

    it('should handle empty groups', () => {
      const format = createThymianFormat();

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateGroupedCommonHttpTransactions(
        method('get'),
        statusCode(),
        () => undefined,
      );

      expect(result).toHaveLength(0);
    });

    it('should group by method', () => {
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

      const context = new StaticApiContext(format, new NoopLogger());

      const groupKeys: string[] = [];
      context.validateGroupedCommonHttpTransactions(
        statusCode(200),
        method(),
        (key) => {
          groupKeys.push(key);
          return undefined;
        },
      );

      expect(groupKeys).toStrictEqual(['GET']);
    });
  });

  describe('validateHttpTransactions', () => {
    it('should validate transactions using filter function', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateHttpTransactions(
        (req, res) => req.method === 'get' && res.statusCode === 200,
      );

      expect(result).toHaveLength(1);
    });

    it('should validate with custom validation function', () => {
      const format = createThymianFormatWithTransaction(
        createHttpRequest({ method: 'get', path: '/users' }),
        createHttpResponse({ statusCode: 200, headers: {} }),
      );

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateHttpTransactions(
        (req) => req.method === 'get',
        (req) => ({
          message: `Found GET request to ${req.path}`,
        }),
      );

      expect(result).toHaveLength(1);
      if (Array.isArray(result)) {
        expect(result?.[0]?.message).toBe('Found GET request to /users');
      }
    });

    it('should handle multiple responses for the same request', () => {
      const format = createThymianFormat();

      const reqId = format.addRequest({
        cookies: {},
        headers: {},
        host: '',
        label: '',
        mediaType: '',
        method: 'get',
        path: '/api/users',
        pathParameters: {},
        port: 8080,
        protocol: 'http',
        queryParameters: {},
        sourceName: '',
        type: 'http-request',
      });

      const [, transactionId] = format.addResponseToRequest(reqId, {
        headers: {},
        label: '',
        mediaType: '',
        sourceName: '',
        statusCode: 200,
        type: 'http-response',
      });

      format.addResponseToRequest(reqId, {
        headers: {},
        label: '',
        mediaType: '',
        sourceName: '',
        statusCode: 400,
        type: 'http-response',
      });

      format.addResponseToRequest(reqId, {
        headers: {},
        label: '',
        mediaType: '',
        sourceName: '',
        statusCode: 404,
        type: 'http-response',
      });

      const context = new StaticApiContext(format, new NoopLogger());

      const result = context.validateHttpTransactions(
        (req, res) => res.statusCode === 200,
      );

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            location: {
              elementType: 'edge',
              elementId: transactionId,
            },
          }),
        ]),
      );
    });
  });
});
