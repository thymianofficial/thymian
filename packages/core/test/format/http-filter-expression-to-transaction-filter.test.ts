import { describe, expect, it } from 'vitest';

import { httpFilterExpressionToTransactionFilter } from '../../src/format/http-filter-expression-to-transaction-filter.js';
import { ThymianFormat } from '../../src/format/thymian-format.js';
import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../../src/index.js';
import {
  and,
  authorization,
  hasRequestBody,
  hasResponseBody,
  method,
  or,
  origin,
  path,
  port,
  protocol,
  queryParameter,
  requestHeader,
  requestMediaType,
  responseHeader,
  responseMediaType,
  statusCode,
  statusCodeRange,
  url,
} from '../../src/index.js';

describe('http-filter-expression-to-transaction-filter', () => {
  const sourceName = 'test-source';

  function createHttpRequest(
    overrides: Partial<ThymianHttpRequest> = {},
  ): ThymianHttpRequest {
    return {
      type: 'http-request',
      host: 'localhost',
      port: 8080,
      protocol: 'http',
      path: '/test',
      method: 'get',
      headers: {},
      queryParameters: {},
      cookies: {},
      pathParameters: {},
      mediaType: '',
      label: 'GET http://localhost:8080/test',
      sourceName,
      ...overrides,
    };
  }

  function createHttpResponse(
    overrides: Partial<ThymianHttpResponse> = {},
  ): ThymianHttpResponse {
    return {
      type: 'http-response',
      headers: {},
      mediaType: 'application/json',
      statusCode: 200,
      label: '200 OK',
      sourceName,
      ...overrides,
    };
  }

  function createFormatWithTransactions(
    transactions: [Partial<ThymianHttpRequest>, Partial<ThymianHttpResponse>][],
  ): ThymianFormat {
    const format = new ThymianFormat();
    for (const [req, res] of transactions) {
      format.addHttpTransaction(
        createHttpRequest(req),
        createHttpResponse(res),
        sourceName,
      );
    }
    return format;
  }

  describe('visitMethod', () => {
    it('should match correct HTTP method', () => {
      const format = createFormatWithTransactions([
        [{ method: 'get' }, {}],
        [{ method: 'post', path: '/users' }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(method('get'));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.method).toBe('get');
    });

    it('should be case-insensitive', () => {
      const format = createFormatWithTransactions([[{ method: 'GET' }, {}]]);

      const filter = httpFilterExpressionToTransactionFilter(method('get'));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should return false for undefined method', () => {
      const format = createFormatWithTransactions([[{ method: 'get' }, {}]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'method',
        kind: 'request',
        method: undefined,
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('visitRequestHeader', () => {
    it('should match when request has header', () => {
      const format = createFormatWithTransactions([
        [
          {
            headers: {
              'content-type': {
                required: true,
                schema: { type: 'string' },
                style: { style: 'simple', explode: false },
              },
            },
          },
          {},
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        requestHeader('content-type'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const format = createFormatWithTransactions([
        [
          {
            headers: {
              'Content-Type': {
                required: true,
                schema: { type: 'string' },
                style: { style: 'simple', explode: false },
              },
            },
          },
          {},
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        requestHeader('CONTENT-TYPE'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should return false for undefined header', () => {
      const format = createFormatWithTransactions([[{}, {}]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'requestHeader',
        kind: 'request',
        header: undefined,
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('visitQueryParam', () => {
    it('should match when query parameter exists', () => {
      const format = createFormatWithTransactions([
        [
          {
            queryParameters: {
              limit: {
                required: false,
                schema: { type: 'integer' },
                style: { style: 'form', explode: true },
              },
            },
          },
          {},
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        queryParameter('limit'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const format = createFormatWithTransactions([
        [
          {
            queryParameters: {
              LIMIT: {
                required: false,
                schema: { type: 'integer' },
                style: { style: 'form', explode: true },
              },
            },
          },
          {},
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        queryParameter('limit'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should return false for undefined param', () => {
      const format = createFormatWithTransactions([[{}, {}]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'queryParam',
        kind: 'request',
        param: undefined,
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('visitPath', () => {
    it('should match path ending', () => {
      const format = createFormatWithTransactions([
        [{ path: '/api/users' }, {}],
        [{ path: '/api/posts' }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(path('/users'));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.path).toBe('/api/users');
    });

    it('should return false for undefined path', () => {
      const format = createFormatWithTransactions([[{}, {}]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'path',
        kind: 'request',
        path: undefined,
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('visitOrigin', () => {
    it('should match origin', () => {
      const format = createFormatWithTransactions([
        [{ protocol: 'http', host: 'localhost', port: 8080 }, {}],
        [{ protocol: 'https', host: 'api.example.com', port: 443 }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        origin('http://localhost:8080'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.host).toBe('localhost');
    });
  });

  describe('visitPort', () => {
    it('should match port', () => {
      const format = createFormatWithTransactions([
        [{ port: 8080 }, {}],
        [{ port: 3000 }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(port(8080));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.port).toBe(8080);
    });
  });

  describe('visitProtocol', () => {
    it('should match protocol', () => {
      const format = createFormatWithTransactions([
        [{ protocol: 'https' }, {}],
        [{ protocol: 'http' }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(protocol('https'));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.protocol).toBe('https');
    });
  });

  describe('visitUrl', () => {
    it('should match complete URL', () => {
      const format = createFormatWithTransactions([
        [
          {
            protocol: 'http',
            host: 'localhost',
            port: 8080,
            path: '/users',
          },
          {},
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        url('http://localhost:8080/users'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('visitHasBody', () => {
    it('should match when request has body', () => {
      const format = createFormatWithTransactions([
        [{ method: 'post', bodyRequired: true }, {}],
        [{ method: 'get', bodyRequired: false }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        hasRequestBody(true),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.bodyRequired).toBe(true);
    });

    it('should match when request does not have body', () => {
      const format = createFormatWithTransactions([
        [{ method: 'get', bodyRequired: false }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        hasRequestBody(false),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('visitRequestMediaType', () => {
    it('should match request media type', () => {
      const format = createFormatWithTransactions([
        [{ method: 'post', mediaType: 'application/json' }, {}],
        [{ method: 'post', mediaType: 'application/xml' }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        requestMediaType('application/json'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.mediaType).toBe('application/json');
    });
  });

  describe('visitStatusCode', () => {
    it('should match status code', () => {
      const format = createFormatWithTransactions([
        [{}, { statusCode: 200 }],
        [{}, { statusCode: 404 }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(statusCode(200));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianRes.statusCode).toBe(200);
    });
  });

  describe('visitStatusCodeRange', () => {
    it('should match status code in range', () => {
      const format = createFormatWithTransactions([
        [{}, { statusCode: 200 }],
        [{}, { statusCode: 201 }],
        [{}, { statusCode: 404 }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        statusCodeRange(200, 299),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(2);
    });

    it('should handle boundary values', () => {
      const format = createFormatWithTransactions([
        [{}, { statusCode: 200 }],
        [{}, { statusCode: 299 }],
        [{}, { statusCode: 300 }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        statusCodeRange(200, 299),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('visitHasResponseBody', () => {
    it('should match when response has body', () => {
      const format = createFormatWithTransactions([
        [{}, { statusCode: 200, schema: { type: 'object' } }],
        [{}, { statusCode: 204 }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        hasResponseBody(true),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianRes.schema).toBeDefined();
    });

    it('should match when response does not have body', () => {
      const format = createFormatWithTransactions([[{}, { statusCode: 204 }]]);

      const filter = httpFilterExpressionToTransactionFilter(
        hasResponseBody(false),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('visitResponseHeader', () => {
    it('should match when response has header', () => {
      const format = createFormatWithTransactions([
        [
          {},
          {
            statusCode: 200,
            headers: {
              'x-rate-limit': {
                required: false,
                schema: { type: 'integer' },
                style: { style: 'simple', explode: false },
              },
            },
          },
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        responseHeader('x-rate-limit'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const format = createFormatWithTransactions([
        [
          {},
          {
            statusCode: 200,
            headers: {
              'Content-Type': {
                required: true,
                schema: { type: 'string' },
                style: { style: 'simple', explode: false },
              },
            },
          },
        ],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        responseHeader('CONTENT-TYPE'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should return false for undefined header', () => {
      const format = createFormatWithTransactions([[{}, {}]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'responseHeader',
        header: undefined,
        kind: 'response',
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('visitResponseMediaType', () => {
    it('should match response media type', () => {
      const format = createFormatWithTransactions([
        [{}, { statusCode: 200, mediaType: 'application/json' }],
        [{}, { statusCode: 200, mediaType: 'application/xml' }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        responseMediaType('application/json'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianRes.mediaType).toBe('application/json');
    });
  });

  describe('visitIsAuthorized', () => {
    it('should match secured requests', () => {
      const format = new ThymianFormat();
      const [reqId] = format.addHttpTransaction(
        createHttpRequest(),
        createHttpResponse(),
        sourceName,
      );
      const schemeNode = format.addSecurityScheme({
        label: '',
        scheme: 'basic',
        sourceName: 'test',
        type: 'security-scheme',
      });

      format.addEdge(reqId, schemeNode, {
        label: 'basic',
        type: 'is-secured',
        sourceName: 'test',
      });

      const filter = httpFilterExpressionToTransactionFilter(
        authorization(true),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });

    it('should match unsecured requests', () => {
      const format = createFormatWithTransactions([[{}, {}]]);

      const filter = httpFilterExpressionToTransactionFilter(
        authorization(false),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('visitHasResponse', () => {
    it('should apply nested filter', () => {
      const format = createFormatWithTransactions([[{}, { statusCode: 200 }]]);

      const filter = httpFilterExpressionToTransactionFilter({
        type: 'hasResponse',
        kind: 'request',
        filter: statusCode(200),
      });
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('visitResponseTrailer', () => {
    it('should throw error', () => {
      expect(() =>
        httpFilterExpressionToTransactionFilter({
          type: 'responseTrailer',
          kind: 'response',
        }),
      ).toThrow('Response trailers are not currently supported');
    });
  });

  describe('complex filters', () => {
    it('should handle AND logic', () => {
      const format = createFormatWithTransactions([
        [{ method: 'get' }, { statusCode: 200 }],
        [{ method: 'post' }, { statusCode: 200 }],
        [{ method: 'get' }, { statusCode: 404 }],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        and(method('get'), statusCode(200)),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(1);
      expect(result[0].thymianReq.method).toBe('get');
      expect(result[0].thymianRes.statusCode).toBe(200);
    });

    it('should handle OR logic', () => {
      const format = createFormatWithTransactions([
        [{ method: 'get' }, {}],
        [{ method: 'post' }, {}],
        [{ method: 'delete' }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        or(method('get'), method('post')),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(2);
    });

    it('should handle nested filters', () => {
      const format = createFormatWithTransactions([
        [{ method: 'get', port: 8080 }, {}],
        [{ method: 'post', port: 8080 }, {}],
        [{ method: 'get', port: 3000 }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        and(or(method('get'), method('post')), port(8080)),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty transactions array', () => {
      const format = new ThymianFormat();
      const filter = httpFilterExpressionToTransactionFilter(method('get'));
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });

    it('should handle transactions with empty headers', () => {
      const format = createFormatWithTransactions([[{ headers: {} }, {}]]);

      const filter = httpFilterExpressionToTransactionFilter(
        requestHeader('content-type'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });

    it('should handle transactions with empty query parameters', () => {
      const format = createFormatWithTransactions([
        [{ queryParameters: {} }, {}],
      ]);

      const filter = httpFilterExpressionToTransactionFilter(
        queryParameter('limit'),
      );
      const transactions = format.getThymianHttpTransactions();

      const result = transactions.filter((t) =>
        filter(t, transactions, format),
      );

      expect(result).toHaveLength(0);
    });
  });
});
