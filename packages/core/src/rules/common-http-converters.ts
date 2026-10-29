import type {
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '../format/index.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import type { Logger } from '../logger/logger.js';
import {
  getHeader,
  httpRequestToLabel,
  httpResponseToLabel,
} from '../utils.js';
import type { CommonHttpRequest, CommonHttpResponse } from './contexts.js';

export function thymianToCommonHttpRequest(
  node: ThymianHttpRequest,
  _id: string,
): CommonHttpRequest {
  void _id;

  return {
    origin: `${node.protocol}://${node.host}:${node.port}`,
    path: node.path,
    method: node.method,
    headers: Object.keys(node.headers),
    queryParameters: Object.keys(node.queryParameters),
    cookies: Object.keys(node.cookies),
    mediaType: node.mediaType,
    body: node.bodyRequired ?? false,
  };
}

export function thymianToCommonHttpResponse(
  node: ThymianHttpResponse,
  _id: string,
): CommonHttpResponse {
  void _id;

  return {
    body: !!node.schema,
    headers: Object.keys(node.headers),
    mediaType: normalizeMediaType(node.mediaType),
    statusCode: node.statusCode,
    trailers: [],
  };
}

export type HttpRequestConversionOptions = {
  /** The Thymian node id of the request, when there is one. */
  id?: string;
  /** How warnings name the request. Defaults to the request's own label. */
  label?: string;
  logger?: Logger;
};

export function httpRequestToCommonHttpRequest(
  request: HttpRequest,
  options: HttpRequestConversionOptions = {},
): CommonHttpRequest {
  const ct = request.headers
    ? getHeader(request.headers, 'content-type')
    : undefined;

  return {
    origin: request.origin,
    path: request.path,
    target: request.target,
    method: request.method,
    headers: Object.keys(request.headers ?? {}),
    queryParameters: Array.from(
      new URLSearchParams(request.path.split('?')[1] ?? '').keys(),
    ),
    cookies: [],
    mediaType:
      singleContentType(ct, 'request', options, () =>
        httpRequestToLabel(request),
      ) ?? '',
    body: !!request.body,
  };
}

/**
 * The one Content-Type value of a message. Content-Type is a single valued
 * field (RFC 9110 §8.3), so a duplicated one takes the first value and warns.
 */
function singleContentType(
  ct: string | string[] | undefined,
  message: 'request' | 'response',
  { id, label, logger }: HttpRequestConversionOptions,
  defaultLabel: () => string,
): string | undefined {
  if (!Array.isArray(ct)) {
    return ct;
  }

  if (ct.length > 1) {
    const name = label ?? defaultLabel();

    logger?.warn(
      `Content-Type is a single valued field, but ${ct.length} values were received for ${message} ${id ? `${id} (${name})` : `"${name}"`}. Using the first one.`,
    );
  }

  return ct[0];
}

// RFC 9110 §8.3.1: type "/" subtype, each a token (RFC 9110 §5.6.2).
const MEDIA_TYPE = /^[a-z0-9!#$%&'*+.^_`|~-]+\/[a-z0-9!#$%&'*+.^_`|~-]+$/;

/**
 * The bare, lowercased `type/subtype` of a `Content-Type` value, with
 * parameters removed. Empty when the value is not a single `type/subtype`.
 */
export function normalizeMediaType(value: string | undefined): string {
  const mediaType = value?.split(';')[0]?.trim().toLowerCase() ?? '';

  return MEDIA_TYPE.test(mediaType) ? mediaType : '';
}

function getMediaType(
  response: HttpResponse,
  options: HttpResponseConversionOptions,
): string {
  return normalizeMediaType(
    singleContentType(
      getHeader(response.headers, 'content-type'),
      'response',
      options,
      () => httpResponseToLabel(response),
    ),
  );
}

export type HttpResponseConversionOptions = {
  /** The Thymian node id of the response, when there is one. */
  id?: string;
  /** How warnings name the response. Defaults to the response's own label. */
  label?: string;
  logger?: Logger;
};

export function httpResponseToCommonHttpResponse(
  response: HttpResponse,
  options: HttpResponseConversionOptions = {},
): CommonHttpResponse {
  return {
    body: !!response.body,
    headers: Object.keys(response.headers),
    mediaType: getMediaType(response, options),
    statusCode: response.statusCode,
    trailers: Object.keys(response.trailers),
  };
}
