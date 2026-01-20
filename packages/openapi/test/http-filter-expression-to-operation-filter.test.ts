import {
  and,
  DEFAULT_HEADER_SERIALIZATION_STYLE,
  DEFAULT_QUERY_SERIALIZATION_STYLE,
  hasRequestBody,
  hasResponseBody,
  method,
  or,
  origin,
  path as pathFilter,
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
} from '@thymian/core';
import type { OpenAPIV3_1 as OpenApiV31 } from 'openapi-types';
import { describe, expect, it } from 'vitest';

import { httpFilterExpressionToOperationFilter } from '../src/http-filter-expression-to-operation-filter.js';
import type { ServerInfo } from '../src/processors/extract-server-info.js';
import type { Parameters } from '../src/processors/utils.js';

describe('httpFilterExpressionToOperationFilter', () => {
  const defaultServerInfo: ServerInfo = {
    protocol: 'http',
    host: 'localhost',
    port: 8080,
    basePath: '',
  };

  const defaultParams: Parameters = {
    headers: {},
    cookies: {},
    pathParameters: {},
    queryParameters: {},
  };

  const defaultDocument: OpenApiV31.Document = {
    openapi: '3.1.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {},
  };

  const createOperationArgs = (
    overrides: Partial<{
      operationObject: OpenApiV31.OperationObject;
      params: Parameters;
      method: string;
      path: string;
      serverInfo: ServerInfo;
      document: OpenApiV31.Document;
    }>,
  ) => ({
    operationObject: {},
    params: defaultParams,
    method: 'get',
    path: '/users',
    serverInfo: defaultServerInfo,
    document: defaultDocument,
    ...overrides,
  });

  describe('visitMethod', () => {
    it('matches the correct HTTP method (case-insensitive)', () => {
      const filter = httpFilterExpressionToOperationFilter(method('get'));

      expect(filter(createOperationArgs({ method: 'get' }))).toBe(true);
      expect(filter(createOperationArgs({ method: 'GET' }))).toBe(true);
      expect(filter(createOperationArgs({ method: 'post' }))).toBe(false);
    });
  });

  describe('visitPath', () => {
    it('matches the exact path', () => {
      const filter = httpFilterExpressionToOperationFilter(
        pathFilter('/users'),
      );

      expect(filter(createOperationArgs({ path: '/users' }))).toBe(true);
      expect(filter(createOperationArgs({ path: '/posts' }))).toBe(false);
    });
  });

  describe('visitRequestHeader', () => {
    it('matches when header is present in params', () => {
      const filter = httpFilterExpressionToOperationFilter(
        requestHeader('authorization'),
      );

      expect(
        filter(
          createOperationArgs({
            params: {
              ...defaultParams,
              headers: {
                Authorization: {
                  required: true,
                  schema: { type: 'string' },
                  style: DEFAULT_HEADER_SERIALIZATION_STYLE,
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(filter(createOperationArgs({ params: defaultParams }))).toBe(
        false,
      );
    });

    it('is case-insensitive when matching headers', () => {
      const filter = httpFilterExpressionToOperationFilter(
        requestHeader('content-type'),
      );

      expect(
        filter(
          createOperationArgs({
            params: {
              ...defaultParams,
              headers: {
                'Content-Type': {
                  required: true,
                  schema: {
                    type: 'string',
                  },
                  style: DEFAULT_HEADER_SERIALIZATION_STYLE,
                },
              },
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('visitQueryParam', () => {
    it('matches when query parameter is present in params', () => {
      const filter = httpFilterExpressionToOperationFilter(
        queryParameter('limit'),
      );

      expect(
        filter(
          createOperationArgs({
            params: {
              ...defaultParams,
              queryParameters: {
                limit: {
                  required: false,
                  schema: { type: 'integer' },
                  style: DEFAULT_QUERY_SERIALIZATION_STYLE,
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(filter(createOperationArgs({ params: defaultParams }))).toBe(
        false,
      );
    });

    it('is case-insensitive when matching query parameters', () => {
      const filter = httpFilterExpressionToOperationFilter(
        queryParameter('LIMIT'),
      );

      expect(
        filter(
          createOperationArgs({
            params: {
              ...defaultParams,
              queryParameters: {
                limit: {
                  required: false,
                  schema: {
                    type: 'integer',
                  },
                  style: DEFAULT_QUERY_SERIALIZATION_STYLE,
                },
              },
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('visitOrigin', () => {
    it('matches the correct origin', () => {
      const filter = httpFilterExpressionToOperationFilter(
        origin('http://localhost:8080'),
      );

      expect(
        filter(
          createOperationArgs({
            serverInfo: {
              protocol: 'http',
              host: 'localhost',
              port: 8080,
              basePath: '',
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            serverInfo: {
              protocol: 'https',
              host: 'api.example.com',
              port: 443,
              basePath: '',
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitPort', () => {
    it('matches the correct port', () => {
      const filter = httpFilterExpressionToOperationFilter(port(8080));

      expect(
        filter(
          createOperationArgs({
            serverInfo: { ...defaultServerInfo, port: 8080 },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            serverInfo: { ...defaultServerInfo, port: 3000 },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitProtocol', () => {
    it('matches the correct protocol', () => {
      const filter = httpFilterExpressionToOperationFilter(protocol('https'));

      expect(
        filter(
          createOperationArgs({
            serverInfo: { ...defaultServerInfo, protocol: 'https' },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            serverInfo: { ...defaultServerInfo, protocol: 'http' },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitUrl', () => {
    it('matches the complete URL', () => {
      const filter = httpFilterExpressionToOperationFilter(
        url('http://localhost:8080/users'),
      );

      expect(
        filter(
          createOperationArgs({
            serverInfo: defaultServerInfo,
            path: '/users',
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            serverInfo: defaultServerInfo,
            path: '/posts',
          }),
        ),
      ).toBe(false);
    });

    it('handles paths without leading slash', () => {
      const filter = httpFilterExpressionToOperationFilter(
        url('http://localhost:8080/users'),
      );

      expect(
        filter(
          createOperationArgs({
            serverInfo: defaultServerInfo,
            path: 'users',
          }),
        ),
      ).toBe(true);
    });
  });

  describe('visitHasBody', () => {
    it('matches when operation has a request body', () => {
      const filter = httpFilterExpressionToOperationFilter(
        hasRequestBody(true),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              requestBody: {
                content: { 'application/json': {} },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {},
          }),
        ),
      ).toBe(false);
    });

    it('matches when operation does not have a request body', () => {
      const filter = httpFilterExpressionToOperationFilter(
        hasRequestBody(false),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {},
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              requestBody: {
                content: { 'application/json': {} },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitRequestMediaType', () => {
    it('matches when request has the specified media type', () => {
      const filter = httpFilterExpressionToOperationFilter(
        requestMediaType('application/json'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              requestBody: {
                content: {
                  'application/xml': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });

    it('is case-insensitive when matching media types', () => {
      const filter = httpFilterExpressionToOperationFilter(
        requestMediaType('APPLICATION/JSON'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('visitStatusCode', () => {
    it('matches when operation has response with specific status code', () => {
      const filter = httpFilterExpressionToOperationFilter(statusCode(200));

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '404': {
                  description: 'Not Found',
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });

    it('ignores default responses', () => {
      const filter = httpFilterExpressionToOperationFilter(statusCode(200));

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                default: {
                  description: 'Default response',
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitStatusCodeRange', () => {
    it('matches when operation has response in status code range', () => {
      const filter = httpFilterExpressionToOperationFilter(
        statusCodeRange(200, 299),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': { description: 'OK' },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '201': { description: 'Created' },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '404': { description: 'Not Found' },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitHasResponseBody', () => {
    it('matches when operation has response body', () => {
      const filter = httpFilterExpressionToOperationFilter(
        hasResponseBody(true),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '204': {
                  description: 'No Content',
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });

    it('matches when operation does not have response body', () => {
      const filter = httpFilterExpressionToOperationFilter(
        hasResponseBody(false),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '204': {
                  description: 'No Content',
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('visitResponseHeader', () => {
    it('matches when response has the specified header', () => {
      const filter = httpFilterExpressionToOperationFilter(
        responseHeader('x-rate-limit'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  headers: {
                    'X-Rate-Limit': {
                      schema: { type: 'integer' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });

    it('is case-insensitive when matching response headers', () => {
      const filter = httpFilterExpressionToOperationFilter(
        responseHeader('CONTENT-TYPE'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  headers: {
                    'content-type': {
                      schema: { type: 'string' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('visitResponseMediaType', () => {
    it('matches when response has the specified media type', () => {
      const filter = httpFilterExpressionToOperationFilter(
        responseMediaType('application/json'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            operationObject: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/xml': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('complex filters with and/or', () => {
    it('matches with AND logic', () => {
      const filter = httpFilterExpressionToOperationFilter(
        and(method('get'), statusCode(200)),
      );

      expect(
        filter(
          createOperationArgs({
            method: 'get',
            operationObject: {
              responses: {
                '200': { description: 'OK' },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            method: 'post',
            operationObject: {
              responses: {
                '200': { description: 'OK' },
              },
            },
          }),
        ),
      ).toBe(false);

      expect(
        filter(
          createOperationArgs({
            method: 'get',
            operationObject: {
              responses: {
                '404': { description: 'Not Found' },
              },
            },
          }),
        ),
      ).toBe(false);
    });

    it('matches with OR logic', () => {
      const filter = httpFilterExpressionToOperationFilter(
        or(method('get'), method('post')),
      );

      expect(filter(createOperationArgs({ method: 'get' }))).toBe(true);
      expect(filter(createOperationArgs({ method: 'post' }))).toBe(true);
      expect(filter(createOperationArgs({ method: 'delete' }))).toBe(false);
    });

    it('handles complex nested filters', () => {
      const filter = httpFilterExpressionToOperationFilter(
        and(
          or(method('get'), method('post')),
          queryParameter('limit'),
          statusCodeRange(200, 299),
        ),
      );

      expect(
        filter(
          createOperationArgs({
            method: 'get',
            params: {
              ...defaultParams,
              queryParameters: {
                limit: {
                  required: false,
                  schema: { type: 'string' },
                  style: DEFAULT_HEADER_SERIALIZATION_STYLE,
                },
              },
            },
            operationObject: {
              responses: {
                '200': { description: 'OK' },
              },
            },
          }),
        ),
      ).toBe(true);

      expect(
        filter(
          createOperationArgs({
            method: 'delete',
            params: {
              ...defaultParams,
              queryParameters: {
                limit: {
                  required: false,
                  schema: { type: 'string' },
                  style: DEFAULT_HEADER_SERIALIZATION_STYLE,
                },
              },
            },
            operationObject: {
              responses: {
                '200': { description: 'OK' },
              },
            },
          }),
        ),
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles operations without responses', () => {
      const filter = httpFilterExpressionToOperationFilter(statusCode(200));

      expect(
        filter(
          createOperationArgs({
            operationObject: {},
          }),
        ),
      ).toBe(false);
    });

    it('handles operations without requestBody', () => {
      const filter = httpFilterExpressionToOperationFilter(
        requestMediaType('application/json'),
      );

      expect(
        filter(
          createOperationArgs({
            operationObject: {},
          }),
        ),
      ).toBe(false);
    });

    it('handles empty params object', () => {
      const filter = httpFilterExpressionToOperationFilter(
        queryParameter('nonexistent'),
      );

      expect(
        filter(
          createOperationArgs({
            params: {
              headers: {},
              cookies: {},
              pathParameters: {},
              queryParameters: {},
            },
          }),
        ),
      ).toBe(false);
    });
  });
});
