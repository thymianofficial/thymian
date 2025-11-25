import { describe, expect, it } from 'vitest';

import {
  HttpRequest,
  HttpResponse,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../../src';
import {
  httpRequestToThymianHttpRequest,
  httpResponseToThymianHttpResponse,
} from '../../src/format/utils';

describe('httpRequestToThymianHttpRequest', () => {
  it('should convert a basic HttpRequest to ThymianHttpRequest', () => {
    const request: HttpRequest = {
      origin: 'http://example.com',
      path: '/test',
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
    };

    const result = httpRequestToThymianHttpRequest(request);

    expect(result).toEqual<Partial<ThymianHttpRequest>>({
      host: 'example.com',
      method: 'GET',
      path: '/test',
      mediaType: 'application/json',
      port: 80,
      protocol: 'http',
      type: 'http-request',
      cookies: {},
      headers: {},
      pathParameters: {},
      queryParameters: {},
    });
  });

  it('should handle missing headers and default values correctly', () => {
    const request: HttpRequest = {
      origin: 'https://example.com',
      path: '/test',
      method: 'POST',
    };

    const result = httpRequestToThymianHttpRequest(request);

    expect(result).toEqual<Partial<ThymianHttpRequest>>({
      host: 'example.com',
      method: 'POST',
      path: '/test',
      mediaType: '',
      port: 443,
      protocol: 'https',
      type: 'http-request',
      cookies: {},
      headers: {},
      pathParameters: {},
      queryParameters: {},
    });
  });

  it('should handle array headers correctly', () => {
    const request: HttpRequest = {
      origin: 'http://example.com',
      path: '/test',
      method: 'GET',
      headers: {
        'x-custom-header': ['value1', 'value2'],
      },
    };

    const result = httpRequestToThymianHttpRequest(request);

    expect(result.headers).toEqual({
      'x-custom-header': {
        required: true,
        style: {
          explode: false,
          style: 'simple',
        },
        schema: {
          type: 'string',
          examples: ['value1', 'value2'],
        },
      },
    });
  });

  it('should parse port from origin if specified', () => {
    const request: HttpRequest = {
      origin: 'http://example.com:3000',
      path: '/test',
      method: 'GET',
    };

    const result = httpRequestToThymianHttpRequest(request);

    expect(result.port).toBe(3000);
  });

  it('should default port to 80 for http and 443 for https when not specified', () => {
    const httpRequest: HttpRequest = {
      origin: 'http://example.com',
      path: '/test',
      method: 'GET',
    };

    const httpsRequest: HttpRequest = {
      origin: 'https://example.com',
      path: '/test',
      method: 'GET',
    };

    const httpResult = httpRequestToThymianHttpRequest(httpRequest);
    const httpsResult = httpRequestToThymianHttpRequest(httpsRequest);

    expect(httpResult.port).toBe(80);
    expect(httpsResult.port).toBe(443);
  });
});

describe('httpResponseToThymianHttpResponse', () => {
  it('should convert a basic HttpResponse to ThymianHttpResponse', () => {
    const response: HttpResponse = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: '{"key":"value"}',
      trailers: {},
      duration: 50,
    };

    const result = httpResponseToThymianHttpResponse(response);

    expect(result).toEqual<Partial<ThymianHttpResponse>>({
      type: 'http-response',
      statusCode: 200,
      label: '',
      mediaType: 'application/json',
      schema: {
        type: 'string',
        examples: ['{"key":"value"}'],
      },
      headers: {},
    });
  });

  it('should handle missing headers and body gracefully', () => {
    const response: HttpResponse = {
      statusCode: 404,
      headers: {},
      trailers: {},
      duration: 100,
    };

    const result = httpResponseToThymianHttpResponse(response);

    expect(result).toEqual<Partial<ThymianHttpResponse>>({
      type: 'http-response',
      statusCode: 404,
      mediaType: '',
      label: '',
      headers: {},
    });
  });

  it('should handle array headers correctly', () => {
    const response: HttpResponse = {
      statusCode: 200,
      headers: {
        'x-multiple-values': ['value1', 'value2'],
      },
      trailers: {},
      duration: 30,
    };

    const result = httpResponseToThymianHttpResponse(response);

    expect(result.headers).toEqual({
      'x-multiple-values': {
        required: true,
        style: {
          explode: false,
          style: 'simple',
        },
        schema: {
          type: 'string',
          examples: ['value1', 'value2'],
        },
      },
    });
  });

  it('should parse a response with a body correctly', () => {
    const response: HttpResponse = {
      statusCode: 500,
      headers: {
        'content-type': 'text/plain',
      },
      body: 'Internal Server Error',
      trailers: {},
      duration: 500,
    };

    const result = httpResponseToThymianHttpResponse(response);

    expect(result.schema).toEqual({
      type: 'string',
      examples: ['Internal Server Error'],
    });
  });
});
