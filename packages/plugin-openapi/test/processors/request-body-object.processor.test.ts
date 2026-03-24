import type { OpenAPIV3_1 } from 'openapi-types';
import { describe, expect, it, vi } from 'vitest';

import { LocMapper } from '../../src/loc-mapper/loc-mapper.js';
import { processRequestBodyObjet } from '../../src/processors/request-body-object.processor.js';
import type { Parameters } from '../../src/processors/utils.js';

class MockLocMapper extends LocMapper {
  constructor() {
    super('', '');
  }

  positionForOperationId = vi.fn();
}

describe('processRequestBodyObjet', () => {
  const mockLocMapper = new MockLocMapper();
  const mockParameters: Parameters = {
    headers: {},
    cookies: {},
    pathParameters: {},
    queryParameters: {},
  };
  const baseContext = {
    path: '/test',
    method: 'GET',
    host: 'localhost',
    port: 8080,
    protocol: 'http' as const,
    sourceName: 'test',
  };

  it('returns a default http-request when requestBodyObject is undefined', () => {
    const result = processRequestBodyObjet(
      undefined,
      mockParameters,
      mockLocMapper,
      baseContext,
    );

    expect(result).toEqual([
      {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/test',
        method: 'GET',
        mediaType: '',
        extensions: {
          openapi: {
            operationId: undefined,
          },
        },
        ...mockParameters,
      },
    ]);
  });

  it('processes a valid requestBodyObject with a single supported media type', () => {
    const mockRequestBodyObject: OpenAPIV3_1.RequestBodyObject = {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object', properties: { key: { type: 'string' } } },
        },
      },
      description: 'Test body object',
    };

    const result = processRequestBodyObjet(
      mockRequestBodyObject,
      mockParameters,
      mockLocMapper,
      {
        ...baseContext,
        operationId: 'testOperation',
      },
    );

    expect(result).toEqual([
      {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/test',
        method: 'GET',
        description: 'Test body object',
        bodyRequired: true,
        body: { type: 'object', properties: { key: { type: 'string' } } },
        mediaType: 'application/json',
        extensions: {
          openapi: {
            operationId: 'testOperation',
          },
        },
        location: undefined,
        queryParameters: mockParameters.queryParameters,
        cookies: mockParameters.cookies,
        pathParameters: mockParameters.pathParameters,
        headers: mockParameters.headers,
      },
    ]);
  });

  it('skips unsupported media types such as multipart/form-data or application/x-www-form-urlencoded', () => {
    const mockRequestBodyObject: OpenAPIV3_1.RequestBodyObject = {
      content: {
        'multipart/form-data': {},
        'application/x-www-form-urlencoded': {},
      },
    };

    const result = processRequestBodyObjet(
      mockRequestBodyObject,
      mockParameters,
      mockLocMapper,
      baseContext,
    );

    expect(result).toEqual([]);
  });

  it('handles location mapping when operationId is provided and locMapper has position', () => {
    mockLocMapper.positionForOperationId.mockReturnValueOnce({
      line: 10,
      column: 5,
      offset: 105,
    });

    const mockRequestBodyObject: OpenAPIV3_1.RequestBodyObject = {
      content: {
        'application/json': {
          schema: { type: 'object', properties: { key: { type: 'string' } } },
        },
      },
    };

    const context = { ...baseContext, operationId: 'mappedOperation' };

    const result = processRequestBodyObjet(
      mockRequestBodyObject,
      mockParameters,
      mockLocMapper,
      context,
    );

    expect(result[0]?.sourceLocation).toEqual({
      path: '',
      position: {
        line: 10,
        column: 5,
        offset: 105,
      },
    });
  });

  it('returns an empty array when requestBodyObject.content is empty', () => {
    const mockRequestBodyObject: OpenAPIV3_1.RequestBodyObject = {
      content: {},
    };

    const result = processRequestBodyObjet(
      mockRequestBodyObject,
      mockParameters,
      mockLocMapper,
      baseContext,
    );

    expect(result).toEqual([]);
  });
});
