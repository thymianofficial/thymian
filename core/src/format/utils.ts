import { DEFAULT_HEADER_SERIALIZATION_STYLE } from '../constants.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import {
  equalsIgnoreCase,
  getContentType,
  getHeader,
  type PartialBy,
} from '../utils.js';
import type { ThymianHttpRequest } from './nodes/http-request.node.js';
import type { ThymianHttpResponse } from './nodes/http-response.node.js';
import type { Parameter } from './parameter.js';
import type { SerializationStyle } from './serialization-style/index.js';

export function extractSchemaForValue(
  value: string
): 'string' | 'integer' | 'number' | 'boolean' {
  if (!isNaN(parseInt(value))) {
    return 'integer';
  }

  if (!isNaN(parseFloat(value))) {
    return 'number';
  }

  if (value === 'true' || value === 'false') {
    return 'boolean';
  }

  return 'string';
}

export function valueToParameter(
  value: string | string[] | undefined,
  style: SerializationStyle
): Parameter | undefined {
  if (Array.isArray(value)) {
    return {
      required: true,
      schema: {
        type: extractSchemaForValue(value[0] ?? ''),
        examples: value,
      },
      style,
    };
  }

  if (typeof value === 'string') {
    return {
      required: false,
      schema: {
        type: extractSchemaForValue(value),
        examples: [value],
      },
      style,
    };
  }

  return undefined;
}

export function parameterValuesToParameters(
  values: Record<string, string | string[] | undefined>,
  style: SerializationStyle
): Record<string, Parameter> {
  return Object.entries(values).reduce((acc, [key, value]) => {
    if (equalsIgnoreCase(key, 'content-type')) return acc;

    const parameter = valueToParameter(value, style);

    if (!parameter) return acc;

    acc[key] = parameter;

    return acc;
  }, {} as Record<string, Parameter>);
}

export function httpRequestToThymianHttpRequest(
  request: HttpRequest
): PartialBy<ThymianHttpRequest, 'label'> {
  const url = new URL(request.path, request.origin);

  return {
    host: url.host,
    mediaType: getContentType(request.headers),
    method: request.method,
    path: request.path,
    port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    type: 'http-request',
    cookies: {},
    headers: parameterValuesToParameters(
      request.headers ?? {},
      DEFAULT_HEADER_SERIALIZATION_STYLE
    ),
    pathParameters: {},
    queryParameters: {},
  };
}

export function httpResponseToThymianHttpResponse(
  response: HttpResponse
): ThymianHttpResponse {
  const thymianHttpResponse: ThymianHttpResponse = {
    type: 'http-response',
    label: '',
    statusCode: response.statusCode,
    mediaType: getContentType(response.headers),
    headers: parameterValuesToParameters(
      response.headers ?? {},
      DEFAULT_HEADER_SERIALIZATION_STYLE
    ),
  };

  if (response.body) {
    thymianHttpResponse.schema = {
      type: 'string',
      examples: [response.body],
    };
  }

  return thymianHttpResponse;
}
